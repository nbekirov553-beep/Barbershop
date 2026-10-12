"use client";

import { useState, type FormEvent } from "react";
import type { AdminBarber, AdminBooking, AdminService } from "@barbershop/shared";
import { formatDateLong, formatDuration, formatPhone, formatPrice } from "@barbershop/shared/format";
import { toMinutes, toZoned, zonedToUtc } from "@barbershop/shared/time";
import { Button, Dialog, Field, Notice, StatusBadge, inputClass, sourceLabels } from "@/components/admin/ui";
import { adminApi, errorMessage } from "@/lib/admin-api";
import { TIMEZONE, getTashkentToday } from "@/lib/booking";
import { useRemote } from "@/lib/use-remote";

export const localTime = (iso: string) => toZoned(new Date(iso), TIMEZONE).time;
export const localDate = (iso: string) => toZoned(new Date(iso), TIMEZONE).date;
const toInstant = (date: string, time: string) => zonedToUtc(date, toMinutes(time), TIMEZONE).toISOString();

function SlotPicker({
  barberId,
  serviceIds,
  date,
  excludeId,
  value,
  onChange,
}: {
  barberId: string;
  serviceIds: string[];
  date: string;
  excludeId?: string;
  value: string | null;
  onChange: (time: string) => void;
}) {
  const key = barberId && serviceIds.length > 0 && date ? `${barberId}|${serviceIds.join(",")}|${date}|${excludeId}` : null;
  const slots = useRemote(key, () => adminApi.availability({ barberId, serviceIds, date, excludeId }));

  if (key === null) return <p className="text-sm text-ash">Выберите мастера, услуги и дату.</p>;
  if (slots.status === "loading") return <div className="h-24 animate-pulse bg-graphite-2" />;
  if (slots.status === "error") return <Notice>{errorMessage(slots.error)}</Notice>;
  if (!slots.data || slots.data.slots.length === 0) {
    return <p className="text-sm text-ash">Свободного времени нет: выходной, исключение или всё занято.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="radiogroup" aria-label="Время">
        {slots.data.slots.map((time) => (
          <button
            key={time}
            type="button"
            role="radio"
            aria-checked={value === time}
            onClick={() => onChange(time)}
            className={`h-10 border text-sm tabular-nums transition-colors ${
              value === time ? "border-tungsten bg-tungsten text-graphite" : "border-bone/15 hover:border-bone/40"
            }`}
          >
            {time}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-ash">
        {formatDuration(slots.data.durationMin)}, {formatPrice(slots.data.price)}
      </p>
    </div>
  );
}

type CreateProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (booking: AdminBooking) => void;
  barbers: AdminBarber[];
  services: AdminService[];
  defaultDate: string;
};

export function CreateBookingDialog({ open, onClose, onCreated, barbers, services, defaultDate }: CreateProps) {
  const activeBarbers = barbers.filter((barber) => barber.isActive);
  const [barberId, setBarberId] = useState(activeBarbers[0]?.id ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const barber = barbers.find((item) => item.id === barberId);
  const enabled = new Set(barber?.services.filter((item) => item.isEnabled).map((item) => item.serviceId));
  const available = services.filter((service) => service.isActive && enabled.has(service.id));

  const toggleService = (id: string) => {
    setTime(null);
    setServiceIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!time) return;
    setIsBusy(true);
    setError(null);
    try {
      const booking = await adminApi.createBooking({
        barberId,
        serviceIds,
        startsAt: toInstant(date, time),
        client: { name, phone },
      });
      onCreated(booking);
      setServiceIds([]);
      setTime(null);
      setName("");
      setPhone("+998");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Записать клиента" wide>
      <form onSubmit={submit} className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Мастер">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={barberId}
                onChange={(event) => {
                  setBarberId(event.target.value);
                  setServiceIds([]);
                  setTime(null);
                }}
              >
                {activeBarbers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Дата">
            {(id) => (
              <input
                id={id}
                type="date"
                className={inputClass}
                min={getTashkentToday()}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setTime(null);
                }}
              />
            )}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm text-ash">Услуги</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {available.map((service) => (
              <label
                key={service.id}
                className="flex cursor-pointer items-center gap-3 border border-bone/10 px-3 py-2.5 text-sm hover:border-bone/30 has-checked:border-tungsten/60"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-tungsten"
                  checked={serviceIds.includes(service.id)}
                  onChange={() => toggleService(service.id)}
                />
                <span className="flex-1">{service.name}</span>
                <span className="text-xs text-ash tabular-nums">{formatPrice(service.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="mb-2 text-sm text-ash">Время</p>
          <SlotPicker barberId={barberId} serviceIds={serviceIds} date={date} value={time} onChange={setTime} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Имя клиента">
            {(id) => (
              <input id={id} className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
            )}
          </Field>
          <Field label="Телефон" hint="+998XXXXXXXXX">
            {(id) => (
              <input
                id={id}
                type="tel"
                inputMode="tel"
                className={inputClass}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            )}
          </Field>
        </div>

        {error && <Notice>{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={isBusy || !time || name.trim().length < 2}>
            {isBusy ? "Записываем…" : "Записать"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

type DetailsProps = {
  booking: AdminBooking | null;
  onClose: () => void;
  onChanged: (booking: AdminBooking) => void;
};

/** Карточка записи: статус, контакты и действия. Перенос открывается внутри карточки. */
export function BookingDetailsDialog({ booking, onClose, onChanged }: DetailsProps) {
  const [mode, setMode] = useState<"view" | "cancel" | "reschedule">("view");
  const [date, setDate] = useState(booking ? localDate(booking.startsAt) : getTashkentToday());
  const [time, setTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [shownId, setShownId] = useState(booking?.id);

  if (booking?.id !== shownId) {
    setShownId(booking?.id);
    setMode("view");
    setError(null);
    setTime(null);
    if (booking) setDate(localDate(booking.startsAt));
  }

  if (!booking) return <Dialog open={false} title="" onClose={onClose}>{null}</Dialog>;

  const hasStarted = new Date(booking.startsAt) <= new Date();
  const run = async (body: Parameters<typeof adminApi.updateBooking>[1]) => {
    setIsBusy(true);
    setError(null);
    try {
      const updated = await adminApi.updateBooking(booking.id, body);
      onChanged(updated);
      setMode("view");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open title={booking.client.name} onClose={onClose} wide={mode === "reschedule"}>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-3 text-sm">
        <dt className="text-ash">Статус</dt>
        <dd>
          <StatusBadge status={booking.status} />
          {booking.autoCompleted && <span className="ml-2 text-xs text-ash">отмечено автоматически</span>}
        </dd>
        <dt className="text-ash">Когда</dt>
        <dd className="tabular-nums">
          {formatDateLong(localDate(booking.startsAt))}, {localTime(booking.startsAt)}–{localTime(booking.endsAt)}
        </dd>
        <dt className="text-ash">Мастер</dt>
        <dd>{booking.barber.name}</dd>
        <dt className="text-ash">Услуги</dt>
        <dd>{booking.services.join(", ")}</dd>
        <dt className="text-ash">Сумма</dt>
        <dd className="tabular-nums">{formatPrice(booking.totalPrice)}</dd>
        <dt className="text-ash">Телефон</dt>
        <dd>
          <a href={`tel:${booking.client.phone}`} className="underline decoration-bone/30 underline-offset-4 hover:decoration-tungsten">
            {formatPhone(booking.client.phone)}
          </a>
          {booking.client.hasTelegram && <span className="ml-2 text-xs text-ash">есть Telegram</span>}
        </dd>
        <dt className="text-ash">Источник</dt>
        <dd>{sourceLabels[booking.source]}</dd>
      </dl>

      {mode === "reschedule" && (
        <div className="mt-8 space-y-5 border-t border-bone/10 pt-6">
          <Field label="Новая дата">
            {(id) => (
              <input
                id={id}
                type="date"
                className={`${inputClass} sm:max-w-xs`}
                min={getTashkentToday()}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setTime(null);
                }}
              />
            )}
          </Field>
          <SlotPicker
            barberId={booking.barber.id}
            serviceIds={booking.serviceIds}
            date={date}
            excludeId={booking.id}
            value={time}
            onChange={setTime}
          />
        </div>
      )}

      {mode === "cancel" && (
        <div className="mt-8 border-t border-bone/10 pt-6">
          <Notice tone="info">Клиент получит уведомление в Telegram, если он привязан.</Notice>
        </div>
      )}

      {error && (
        <div className="mt-6">
          <Notice>{error}</Notice>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {mode === "view" && booking.status === "confirmed" && (
          <>
            {hasStarted && (
              <>
                <Button variant="primary" disabled={isBusy} onClick={() => run({ status: "completed" })}>
                  Пришёл
                </Button>
                <Button disabled={isBusy} onClick={() => run({ status: "no_show" })}>
                  Не пришёл
                </Button>
              </>
            )}
            <Button disabled={isBusy || booking.serviceIds.length === 0} onClick={() => setMode("reschedule")}>
              Перенести
            </Button>
            <Button variant="danger" disabled={isBusy} onClick={() => setMode("cancel")}>
              Отменить запись
            </Button>
          </>
        )}
        {mode === "view" && booking.status === "completed" && (
          <Button disabled={isBusy} onClick={() => run({ status: "no_show" })}>
            Отметить «не пришёл»
          </Button>
        )}
        {mode === "view" && booking.status === "no_show" && (
          <Button disabled={isBusy} onClick={() => run({ status: "completed" })}>
            Отметить «пришёл»
          </Button>
        )}
        {mode === "reschedule" && (
          <>
            <Button
              variant="primary"
              disabled={isBusy || !time}
              onClick={() => time && run({ startsAt: toInstant(date, time) })}
            >
              {isBusy ? "Переносим…" : "Перенести"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("view")}>
              Назад
            </Button>
          </>
        )}
        {mode === "cancel" && (
          <>
            <Button variant="danger" disabled={isBusy} onClick={() => run({ status: "cancelled" })}>
              {isBusy ? "Отменяем…" : "Да, отменить"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("view")}>
              Не отменять
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
