"use client";

import Link from "next/link";
import { useState } from "react";
import type { BookingStatus, BookingView } from "@barbershop/shared";
import { toMinutes, toZoned, zonedToUtc } from "@barbershop/shared/time";
import { StepDate, type DaysStatus } from "@/components/booking/StepDate";
import { StepTime, type SlotsStatus } from "@/components/booking/StepTime";
import { TelegramNotifyLink } from "@/components/booking/TelegramNotifyLink";
import { shop } from "@/data/shop";
import { formatDateLong } from "@/lib/booking";
import {
  ClientApiError,
  cancelBooking,
  fetchAvailability,
  fetchAvailabilityDays,
  rescheduleBooking,
} from "@/lib/client-api";
import { formatDuration, formatPrice } from "@/lib/format";

const statusLabels: Record<BookingStatus, string> = {
  confirmed: "Запись подтверждена",
  completed: "Визит состоялся",
  cancelled: "Запись отменена",
  no_show: "Визит пропущен",
};

const primaryButton =
  "flex h-14 items-center justify-center bg-bone px-8 text-sm font-medium text-graphite transition-colors duration-300 hover:bg-tungsten disabled:cursor-not-allowed disabled:bg-bone/15 disabled:text-ash";
const secondaryButton =
  "flex h-14 items-center justify-center border border-bone/25 px-8 text-sm text-bone transition-colors duration-300 hover:border-tungsten hover:text-tungsten disabled:opacity-50";

const getErrorMessage = (error: unknown) =>
  error instanceof ClientApiError && error.status >= 400 && error.status < 500
    ? error.message
    : "Не получилось сохранить изменения. Попробуйте ещё раз.";

type BookingManageProps = { initialBooking: BookingView; today: string };

export function BookingManage({ initialBooking, today }: BookingManageProps) {
  const [booking, setBooking] = useState(initialBooking);
  const [mode, setMode] = useState<"view" | "confirm-cancel" | "reschedule">("view");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [daysStatus, setDaysStatus] = useState<DaysStatus>("loading");
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string | null>(null);
  const [slotsStatus, setSlotsStatus] = useState<SlotsStatus>("loading");
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState<string | null>(null);

  const start = toZoned(new Date(booking.startsAt), booking.timezone);
  const end = toZoned(new Date(booking.endsAt), booking.timezone);
  const query = { serviceIds: booking.serviceIds, barberId: booking.barber.id, excludeToken: booking.token };
  const canReschedule = booking.canReschedule && booking.serviceIds.length > 0;

  const loadDays = () => {
    setDaysStatus("loading");
    fetchAvailabilityDays(query)
      .then((response) => {
        setAvailableDays(new Set(response.days.filter((day) => day.available).map((day) => day.date)));
        setDaysStatus("ready");
      })
      .catch(() => setDaysStatus("error"));
  };

  const loadSlots = (nextDate: string) => {
    setSlotsStatus("loading");
    setTime(null);
    fetchAvailability({ ...query, date: nextDate })
      .then((response) => {
        setSlots(response.slots);
        setSlotsStatus("ready");
      })
      .catch(() => setSlotsStatus("error"));
  };

  const openReschedule = () => {
    setMode("reschedule");
    setError(null);
    setNotice(null);
    setDate(null);
    setTime(null);
    loadDays();
  };

  const selectDate = (value: string) => {
    setDate(value);
    loadSlots(value);
  };

  const run = async (action: () => Promise<BookingView>, successNotice: string) => {
    setIsBusy(true);
    setError(null);
    try {
      setBooking(await action());
      setMode("view");
      setNotice(successNotice);
    } catch (caught) {
      setError(getErrorMessage(caught));
      if (caught instanceof ClientApiError && caught.code === "SLOT_TAKEN" && date) loadSlots(date);
    } finally {
      setIsBusy(false);
    }
  };

  const confirmCancel = () => run(() => cancelBooking(booking.token), "Запись отменена. Будем рады видеть вас в другой раз.");

  const confirmReschedule = () => {
    if (!date || !time) return;
    const startsAt = zonedToUtc(date, toMinutes(time), booking.timezone).toISOString();
    return run(
      () => rescheduleBooking(booking.token, startsAt),
      `Запись перенесена на ${formatDateLong(date)}, ${time}.`,
    );
  };

  const rows = [
    { label: "Мастер", value: booking.barber.name },
    { label: "Дата", value: formatDateLong(start.date) },
    { label: "Время", value: `${start.time}-${end.time}` },
    { label: "Длительность", value: formatDuration(booking.totalDurationMin) },
  ];

  return (
    <div className="grid animate-fade-in gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-7">
        <p className={`text-sm ${booking.status === "confirmed" ? "text-tungsten" : "text-ash"}`}>
          {statusLabels[booking.status]}
        </p>
        <h1 className="text-display mt-4 text-[clamp(2.5rem,6vw,5.5rem)] font-light">
          {booking.client.name}, {booking.status === "cancelled" ? "до встречи" : "ваша запись"}
        </h1>

        <div aria-live="polite">
          {notice && (
            <p className="mt-8 border-l-2 border-tungsten bg-tungsten/[0.06] px-4 py-3 text-sm text-bone">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-8 border-l-2 border-red-400/70 bg-red-400/[0.06] px-4 py-3 text-sm text-bone">
              {error}
            </p>
          )}
        </div>

        {mode === "view" && (
          <>
            {booking.status === "confirmed" && !booking.canCancel && (
              <p className="mt-8 max-w-[46ch] text-ash">
                До визита меньше {booking.cancelCutoffMin} минут, изменить запись онлайн уже нельзя.
                Позвоните нам: <span className="whitespace-nowrap text-bone">{shop.phone}</span>
              </p>
            )}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {canReschedule && (
                <button type="button" onClick={openReschedule} className={primaryButton}>
                  Перенести
                </button>
              )}
              {booking.canCancel && (
                <button type="button" onClick={() => setMode("confirm-cancel")} className={secondaryButton}>
                  Отменить запись
                </button>
              )}
              {booking.status !== "confirmed" && (
                <Link href="/book" className={primaryButton}>
                  Записаться снова
                </Link>
              )}
            </div>
          </>
        )}

        {mode === "confirm-cancel" && (
          <div className="mt-10 border border-bone/15 p-6 sm:p-8">
            <p className="font-display text-xl font-light tracking-[-0.02em]">Отменить запись?</p>
            <p className="mt-3 max-w-[44ch] text-sm text-ash">
              Время освободится для других клиентов. Вернуть запись будет нельзя, только записаться заново.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => void confirmCancel()} disabled={isBusy} className={primaryButton}>
                {isBusy ? "Отменяем" : "Да, отменить"}
              </button>
              <button type="button" onClick={() => setMode("view")} disabled={isBusy} className={secondaryButton}>
                Оставить запись
              </button>
            </div>
          </div>
        )}

        {mode === "reschedule" && (
          <div className="mt-10">
            <h2 className="font-display text-2xl font-light tracking-[-0.02em]">Новый день</h2>
            <div className="mt-6">
              <StepDate
                today={today}
                status={daysStatus}
                available={availableDays}
                selected={date}
                onSelect={selectDate}
                onRetry={loadDays}
              />
            </div>

            {date && (
              <div className="mt-12">
                <h2 className="mb-6 font-display text-2xl font-light tracking-[-0.02em]">
                  Время, {formatDateLong(date)}
                </h2>
                <StepTime
                  status={slotsStatus}
                  slots={slots}
                  selected={time}
                  durationMin={booking.totalDurationMin}
                  onSelect={setTime}
                  onRetry={() => loadSlots(date)}
                  onChangeDate={() => setDate(null)}
                />
              </div>
            )}

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void confirmReschedule()}
                disabled={!date || !time || isBusy}
                className={primaryButton}
              >
                {isBusy ? "Переносим" : time && date ? `Перенести на ${time}` : "Выберите время"}
              </button>
              <button type="button" onClick={() => setMode("view")} disabled={isBusy} className={secondaryButton}>
                Не переносить
              </button>
            </div>
          </div>
        )}
      </div>

      <aside aria-label="Детали записи" className="lg:col-span-5">
        <div className="border border-bone/15 lg:sticky lg:top-28">
          <ul className="space-y-2 border-b border-bone/15 px-5 py-4">
            {booking.services.map((service) => (
              <li key={`${service.serviceId}-${service.name}`} className="flex justify-between gap-4 text-sm">
                <span className="text-bone">{service.name}</span>
                <span className="shrink-0 text-ash tabular-nums">{formatPrice(service.price)}</span>
              </li>
            ))}
          </ul>
          <dl className="border-b border-bone/15 px-5 py-4 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 py-1">
                <dt className="text-ash">{row.label}</dt>
                <dd className={`text-right ${booking.status === "cancelled" ? "text-ash line-through" : "text-bone"}`}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex items-end justify-between gap-4 px-5 py-5">
            <p className="text-xs text-ash">Итого</p>
            <p className="font-display text-2xl font-light tabular-nums">{formatPrice(booking.totalPrice)}</p>
          </div>
        </div>
        {booking.status === "confirmed" && <TelegramNotifyLink token={booking.token} className="mt-4" />}
        <p className="mt-4 text-sm text-ash">
          {shop.address}. {shop.landmark}. Телефон:{" "}
          <span className="whitespace-nowrap">{shop.phone}</span>
        </p>
      </aside>
    </div>
  );
}
