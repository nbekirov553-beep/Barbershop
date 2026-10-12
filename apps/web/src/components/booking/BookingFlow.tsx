"use client";

import type { Barber, BookingView, Service } from "@barbershop/shared";
import { toMinutes, zonedToUtc } from "@barbershop/shared/time";
import { useEffect, useRef, useState } from "react";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { StepBarber } from "@/components/booking/StepBarber";
import { StepContacts } from "@/components/booking/StepContacts";
import { StepDate, type DaysStatus } from "@/components/booking/StepDate";
import { StepServices } from "@/components/booking/StepServices";
import { StepTime, type SlotsStatus } from "@/components/booking/StepTime";
import {
  ANY_BARBER,
  TIMEZONE,
  formatDateLong,
  getTotals,
  isValidName,
  isValidPhone,
} from "@/lib/booking";
import {
  ClientApiError,
  createBooking,
  fetchAvailability,
  fetchAvailabilityDays,
} from "@/lib/client-api";
import { formatDuration, formatPrice } from "@/lib/format";

/** Ошибки, после которых клиенту нужно выбрать другое время. */
const SLOT_ERRORS = new Set(["SLOT_TAKEN", "TOO_SOON", "OUTSIDE_WORKING_HOURS"]);

const steps = [
  { label: "Услуга", title: "Выберите услуги", hint: "Можно несколько: время и стоимость сложатся." },
  { label: "Мастер", title: "Выберите мастера", hint: "Цена не зависит от мастера." },
  { label: "Дата", title: "Выберите день", hint: "Запись открыта на 30 дней вперёд." },
  { label: "Время", title: "Выберите время", hint: "" },
  { label: "Контакты", title: "Оставьте контакты", hint: "Без регистрации и паролей." },
];

type BookingFlowProps = {
  services: Service[];
  barbers: Barber[];
  today: string;
  initialBarberId: string | null;
  initialDate: string | null;
  initialTime: string | null;
  initialServiceIds: string[];
};

export function BookingFlow({
  services,
  barbers,
  today,
  initialBarberId,
  initialDate,
  initialTime,
  initialServiceIds,
}: BookingFlowProps) {
  const [step, setStep] = useState(0);
  const [serviceIds, setServiceIds] = useState<string[]>(initialServiceIds);
  const [barberId, setBarberId] = useState<string | null>(
    initialBarberId ?? (initialTime ? ANY_BARBER : null),
  );
  const [date, setDate] = useState<string | null>(initialDate);
  const [time, setTime] = useState<string | null>(initialTime);
  const [daysStatus, setDaysStatus] = useState<DaysStatus>("loading");
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [slotsStatus, setSlotsStatus] = useState<SlotsStatus>("loading");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsDuration, setSlotsDuration] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [forceErrors, setForceErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingView | null>(null);

  const requestId = useRef(0);
  const daysRequestId = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const totals = getTotals(services, serviceIds);

  const loadDays = async (nextBarberId: string, keepDate: string | null) => {
    const id = ++daysRequestId.current;
    setDaysStatus("loading");
    try {
      const response = await fetchAvailabilityDays({ serviceIds, barberId: nextBarberId });
      if (id !== daysRequestId.current) return;
      const available = new Set(response.days.filter((day) => day.available).map((day) => day.date));
      setAvailableDays(available);
      if (keepDate && !available.has(keepDate)) {
        setDate(null);
        setTime(null);
      }
      setDaysStatus("ready");
    } catch {
      if (id !== daysRequestId.current) return;
      setDaysStatus("error");
    }
  };

  const loadSlots = async (nextBarberId: string, nextDate: string, keepTime: string | null) => {
    const id = ++requestId.current;
    setSlotsStatus("loading");
    try {
      const response = await fetchAvailability({
        serviceIds,
        barberId: nextBarberId,
        date: nextDate,
      });
      if (id !== requestId.current) return;
      setSlots(response.slots);
      setSlotsDuration(response.durationMin);
      setTime(keepTime && response.slots.includes(keepTime) ? keepTime : null);
      setSlotsStatus("ready");
    } catch {
      if (id !== requestId.current) return;
      setSlotsStatus("error");
    }
  };

  const toggleService = (id: string) => {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const selectBarber = (id: string) => {
    if (id === barberId) return;
    setBarberId(id);
    setTime(null);
  };

  const selectDate = (value: string) => {
    if (value === date) return;
    setDate(value);
    setTime(null);
  };

  const switchToAnyBarber = () => {
    if (!date) return;
    setBarberId(ANY_BARBER);
    void loadSlots(ANY_BARBER, date, null);
  };

  const canContinue = [
    serviceIds.length > 0,
    barberId !== null,
    date !== null,
    slotsStatus === "ready" && time !== null,
    !isSubmitting,
  ][step];

  const goTo = (target: number) => {
    setSubmitError(null);
    if (target === 2 && barberId) void loadDays(barberId, date);
    if (target === 3 && barberId && date) void loadSlots(barberId, date, time);
    setStep(target);
  };

  const submit = async () => {
    setForceErrors(true);
    if (!isValidName(name) || !isValidPhone(phone) || !barberId || !date || !time) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      setResult(
        await createBooking({
          serviceIds,
          barberId,
          startsAt: zonedToUtc(date, toMinutes(time), TIMEZONE).toISOString(),
          client: { name: name.trim(), phone },
        }),
      );
    } catch (error) {
      if (error instanceof ClientApiError && SLOT_ERRORS.has(error.code)) {
        setStep(3);
        void loadSlots(barberId, date, null);
        setSubmitError(
          error.code === "SLOT_TAKEN"
            ? `Время ${time} только что заняли. Выберите другое, остальные данные сохранены.`
            : `${error.message}. Выберите другое время, остальные данные сохранены.`,
        );
      } else if (error instanceof ClientApiError && error.status >= 400 && error.status < 500) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Не получилось отправить запись. Попробуйте ещё раз.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const restart = () => {
    setResult(null);
    setStep(0);
    setServiceIds([]);
    setBarberId(null);
    setDate(null);
    setTime(null);
    setForceErrors(false);
  };

  if (result) {
    return (
      <BookingConfirmation services={services} barbers={barbers} booking={result} onRestart={restart} />
    );
  }

  const current = steps[step];
  const summary = (
    <BookingSummary
      services={services}
      barbers={barbers}
      serviceIds={serviceIds}
      barberId={barberId}
      date={date}
      time={time}
    />
  );

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-8">
        <nav aria-label="Шаги записи">
          <ol className="grid grid-cols-5 gap-2">
            {steps.map((item, index) => {
              const isDone = index < step;
              const isCurrent = index === step;
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    disabled={!isDone}
                    onClick={() => goTo(index)}
                    aria-current={isCurrent ? "step" : undefined}
                    className="group w-full text-left disabled:cursor-default"
                  >
                    <span
                      className={`block h-px transition-colors duration-500 ${
                        index <= step ? "bg-tungsten" : "bg-bone/15"
                      }`}
                    />
                    <span
                      className={`mt-3 hidden text-xs transition-colors sm:block ${
                        isCurrent ? "text-bone" : isDone ? "text-ash group-hover:text-bone" : "text-ash/50"
                      }`}
                    >
                      0{index + 1} {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-ash sm:hidden">
            Шаг {step + 1} из {steps.length}: {current.label}
          </p>
        </nav>

        <div key={step} className="mt-12 animate-fade-in">
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-display scroll-mt-28 text-[clamp(2.25rem,5vw,4rem)] font-light outline-none"
          >
            {current.title}
          </h1>
          <p className="mt-4 mb-10 text-ash">
            {step === 3 && date ? `${formatDateLong(date)}. Показаны только свободные окна.` : current.hint}
          </p>

          {submitError && (
            <p role="alert" className="mb-8 border-l-2 border-tungsten bg-tungsten/[0.06] px-4 py-3 text-sm text-bone">
              {submitError}
            </p>
          )}

          {step === 0 && (
            <StepServices services={services} selected={serviceIds} onToggle={toggleService} />
          )}
          {step === 1 && (
            <StepBarber barbers={barbers} selected={barberId} onSelect={selectBarber} />
          )}
          {step === 2 && barberId && (
            <StepDate
              today={today}
              status={daysStatus}
              available={availableDays}
              selected={date}
              onSelect={selectDate}
              onRetry={() => void loadDays(barberId, date)}
            />
          )}
          {step === 3 && (
            <StepTime
              status={slotsStatus}
              slots={slots}
              selected={time}
              durationMin={slotsDuration ?? totals.durationMin}
              onSelect={(value) => {
                setTime(value);
                setSubmitError(null);
              }}
              onRetry={() => {
                if (barberId && date) void loadSlots(barberId, date, time);
              }}
              onChangeDate={() => goTo(2)}
              onAnyBarber={barberId !== ANY_BARBER ? switchToAnyBarber : undefined}
            />
          )}
          {step === 4 && (
            <>
              <StepContacts
                name={name}
                phone={phone}
                forceErrors={forceErrors}
                disabled={isSubmitting}
                onNameChange={setName}
                onPhoneChange={setPhone}
              />
              <div className="mt-10 lg:hidden">{summary}</div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 z-20 -mx-5 mt-12 flex items-center gap-3 border-t border-bone/10 bg-graphite px-5 py-4 sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-0">
          <div className={`min-w-0 flex-1 lg:hidden ${step === 4 ? "invisible" : ""}`}>
            <p className="truncate text-xs text-ash">
              {totals.durationMin ? formatDuration(totals.durationMin) : "Услуги не выбраны"}
            </p>
            <p className="text-sm text-bone tabular-nums">{formatPrice(totals.price)}</p>
          </div>
          {step > 0 && (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={isSubmitting}
              className="flex h-12 items-center justify-center border border-bone/25 px-5 text-sm text-bone transition-colors duration-300 hover:border-tungsten hover:text-tungsten disabled:opacity-50 lg:h-14 lg:px-8"
            >
              Назад
            </button>
          )}
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => (step === 4 ? void submit() : goTo(step + 1))}
            className="flex h-12 items-center justify-center bg-bone px-6 text-sm font-medium text-graphite transition-colors duration-300 hover:bg-tungsten active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-bone/15 disabled:text-ash lg:h-14 lg:px-10"
          >
            {step === 4 ? (isSubmitting ? "Отправляем" : "Подтвердить запись") : "Далее"}
          </button>
        </div>
      </div>

      <aside aria-label="Итог записи" className="hidden lg:col-span-4 lg:block">
        <div className="sticky top-28">{summary}</div>
      </aside>
    </div>
  );
}
