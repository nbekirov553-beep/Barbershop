import type { Barber, BookingView, Me, Service } from "@barbershop/shared";
import {
  formatDateLong,
  formatDuration,
  formatPhone,
  formatPrice,
  isValidName,
  isValidPhone,
} from "@barbershop/shared/format";
import { toMinutes, zonedToUtc } from "@barbershop/shared/time";
import { useState } from "react";
import { WhenPicker, type When } from "../components/WhenPicker";
import { Avatar, Banner, Button, Row, Screen, Section } from "../components/ui";
import { ApiRequestError, api, errorMessage } from "../lib/api";
import { getFirstName, haptic } from "../lib/telegram";

const TIMEZONE = "Asia/Tashkent";
const ANY_BARBER = "any";
const SLOT_ERRORS = new Set(["SLOT_TAKEN", "TOO_SOON", "OUTSIDE_WORKING_HOURS"]);

const steps = [
  { title: "Что делаем?", subtitle: "Можно выбрать несколько услуг" },
  { title: "К кому?", subtitle: "Цена не зависит от мастера" },
  { title: "Когда?", subtitle: "Показаны только свободные окна" },
  { title: "Проверьте запись", subtitle: "Контакты нужны, чтобы мастер мог связаться" },
];

type BookFlowProps = {
  services: Service[];
  barbers: Barber[];
  me: Me | undefined;
  onExit: () => void;
  onDone: (booking: BookingView) => void;
};

export function BookFlow({ services, barbers, me, onExit, onDone }: BookFlowProps) {
  const [step, setStep] = useState(0);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string>(ANY_BARBER);
  const [when, setWhen] = useState<When>({ date: null, time: null });
  const [pickerAttempt, setPickerAttempt] = useState(0);
  const [name, setName] = useState(me?.client?.name ?? getFirstName());
  const [phone, setPhone] = useState(me?.client ? formatPhone(me.client.phone) : "");
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = services.filter((service) => serviceIds.includes(service.id));
  const totalPrice = selected.reduce((sum, service) => sum + service.price, 0);
  const totalDuration = selected.reduce((sum, service) => sum + service.durationMin, 0);
  const barber = barbers.find((item) => item.id === barberId) ?? null;

  const goBack = () => {
    setError(null);
    if (step === 0) onExit();
    else setStep(step - 1);
  };

  const goNext = () => {
    haptic.tap();
    setError(null);
    setStep(step + 1);
  };

  const toggleService = (id: string) => {
    haptic.select();
    setServiceIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    setWhen({ date: null, time: null });
  };

  const selectBarber = (id: string) => {
    haptic.select();
    setBarberId(id);
    setWhen({ date: when.date, time: null });
  };

  const submit = async () => {
    setShowErrors(true);
    if (!isValidName(name) || !isValidPhone(phone) || !when.date || !when.time) {
      haptic.error();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const booking = await api.createBooking({
        serviceIds,
        barberId,
        startsAt: zonedToUtc(when.date, toMinutes(when.time), TIMEZONE).toISOString(),
        client: { name: name.trim(), phone },
      });
      haptic.success();
      onDone(booking);
    } catch (caught) {
      haptic.error();
      if (caught instanceof ApiRequestError && SLOT_ERRORS.has(caught.code)) {
        setError(
          caught.code === "SLOT_TAKEN"
            ? `Время ${when.time} только что заняли. Выберите другое — остальное сохранено.`
            : `${caught.message}. Выберите другое время.`,
        );
        setWhen({ date: when.date, time: null });
        setPickerAttempt((value) => value + 1);
        setStep(2);
      } else {
        setError(errorMessage(caught));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const canContinue = [serviceIds.length > 0, true, when.time !== null, !isSubmitting][step];
  const current = steps[step];

  const footer = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-hint">
          {totalDuration ? formatDuration(totalDuration) : "Услуги не выбраны"}
          {when.time && step >= 2 ? ` · ${when.time}` : ""}
        </p>
        <p className="text-[15px] font-medium tabular-nums">{formatPrice(totalPrice)}</p>
      </div>
      <Button
        fit
        className="min-w-[9.5rem]"
        disabled={!canContinue}
        onClick={() => (step === 3 ? void submit() : goNext())}
      >
        {step === 3 ? (isSubmitting ? "Записываем…" : "Записаться") : "Далее"}
      </Button>
    </div>
  );

  return (
    <Screen
      title={current.title}
      subtitle={`Шаг ${step + 1} из ${steps.length}. ${current.subtitle}`}
      onBack={isSubmitting ? undefined : goBack}
      footer={footer}
    >
      {error && <Banner tone="error">{error}</Banner>}

      {step === 0 && (
        <Section>
          {services.map((service) => {
            const isActive = serviceIds.includes(service.id);
            return (
              <button
                key={service.id}
                type="button"
                role="checkbox"
                aria-checked={isActive}
                onClick={() => toggleService(service.id)}
                className="flex w-full items-center gap-3 border-b border-separator px-4 py-3.5 text-left last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs transition-colors ${
                    isActive ? "border-accent bg-accent text-on-accent" : "border-hint/40"
                  }`}
                >
                  {isActive && "✓"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px]">{service.name}</span>
                  <span className="mt-0.5 block text-xs text-hint">{formatDuration(service.durationMin)}</span>
                </span>
                <span className="shrink-0 text-[15px] tabular-nums">{formatPrice(service.price)}</span>
              </button>
            );
          })}
        </Section>
      )}

      {step === 1 && (
        <Section>
          {[{ id: ANY_BARBER, name: "Любой свободный", photoUrl: null } as const, ...barbers].map((item) => {
            const isActive = item.id === barberId;
            const details =
              "rating" in item
                ? [item.rating ? `★ ${item.rating.toFixed(1)}` : null, item.specialties.slice(0, 2).join(", ")]
                    .filter(Boolean)
                    .join(" · ")
                : "Покажем все свободные окна";
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => selectBarber(item.id)}
                className="flex w-full items-center gap-3 border-b border-separator px-4 py-3 text-left last:border-b-0"
              >
                {item.id === ANY_BARBER ? (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-lg text-hint">
                    ∗
                  </span>
                ) : (
                  <Avatar name={item.name} photoUrl={item.photoUrl} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px]">{item.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-hint">{details}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`h-5 w-5 shrink-0 rounded-full border-2 transition-colors ${
                    isActive ? "border-[6px] border-accent" : "border-hint/40"
                  }`}
                />
              </button>
            );
          })}
        </Section>
      )}

      {step === 2 && (
        <WhenPicker
          key={pickerAttempt}
          serviceIds={serviceIds}
          barberId={barberId}
          value={when}
          onChange={(value) => {
            setError(null);
            setWhen(value);
          }}
        />
      )}

      {step === 3 && when.date && when.time && (
        <>
          <Section>
            {selected.map((service) => (
              <Row key={service.id} label={service.name} value={<span className="tabular-nums">{formatPrice(service.price)}</span>} />
            ))}
          </Section>
          <Section>
            <Row label="Мастер" value={barber?.name ?? "Любой свободный"} />
            <Row label="Дата" value={formatDateLong(when.date)} />
            <Row label="Время" value={<span className="tabular-nums">{when.time}</span>} />
            <Row label="Итого" value={<span className="tabular-nums">{formatPrice(totalPrice)}</span>} />
          </Section>

          <Section title="Контакты">
            <Field
              id="name"
              label="Имя"
              value={name}
              autoComplete="given-name"
              error={showErrors && !isValidName(name) ? "Минимум 2 буквы" : null}
              onChange={setName}
            />
            <Field
              id="phone"
              label="Телефон"
              value={phone}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+998 90 123-45-67"
              error={showErrors && !isValidPhone(phone) ? "Номер в формате +998 XX XXX-XX-XX" : null}
              onChange={(value) => setPhone(formatPhone(value))}
            />
          </Section>
          <p className="px-1 text-xs text-hint">
            Отменить или перенести запись можно в разделе «Мои записи».
          </p>
        </>
      )}
    </Screen>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  inputMode?: "tel" | "text";
  autoComplete?: string;
  placeholder?: string;
};

function Field({ id, label, value, error, onChange, ...input }: FieldProps) {
  return (
    <label htmlFor={id} className="block border-b border-separator px-4 py-2.5 last:border-b-0">
      <span className="block text-xs text-hint">{label}</span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-0.5 w-full bg-transparent text-[16px] text-text outline-none placeholder:text-hint/60"
        {...input}
      />
      {error && (
        <span id={`${id}-error`} className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}
