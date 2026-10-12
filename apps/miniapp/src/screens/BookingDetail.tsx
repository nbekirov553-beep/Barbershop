import type { BookingView } from "@barbershop/shared";
import { formatDateLong, formatDuration, formatPrice } from "@barbershop/shared/format";
import { toMinutes, zonedToUtc } from "@barbershop/shared/time";
import { useState } from "react";
import { WhenPicker, type When } from "../components/WhenPicker";
import { Banner, Button, Row, Screen, Section } from "../components/ui";
import { ApiRequestError, api, errorMessage } from "../lib/api";
import { describeBooking, statusLabels } from "../lib/booking";
import { haptic } from "../lib/telegram";

type BookingDetailProps = {
  booking: BookingView;
  onBack: () => void;
  onChanged: (booking: BookingView) => void;
};

export function BookingDetail({ booking, onBack, onChanged }: BookingDetailProps) {
  const [mode, setMode] = useState<"view" | "cancel" | "reschedule">("view");
  const [when, setWhen] = useState<When>({ date: null, time: null });
  const [pickerAttempt, setPickerAttempt] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const info = describeBooking(booking);
  const canReschedule = booking.canReschedule && booking.serviceIds.length > 0;

  const run = async (action: () => Promise<BookingView>, success: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const updated = await action();
      haptic.success();
      onChanged(updated);
      setMode("view");
      setNotice(success);
    } catch (caught) {
      haptic.error();
      setError(errorMessage(caught));
      if (caught instanceof ApiRequestError && caught.code === "SLOT_TAKEN") {
        setWhen({ date: when.date, time: null });
        setPickerAttempt((value) => value + 1);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const reschedule = () => {
    if (!when.date || !when.time) return;
    const startsAt = zonedToUtc(when.date, toMinutes(when.time), booking.timezone).toISOString();
    void run(() => api.reschedule(booking.token, startsAt), `Перенесли на ${formatDateLong(when.date)}, ${when.time}.`);
  };

  const back = () => {
    if (mode === "view") onBack();
    else {
      setMode("view");
      setError(null);
    }
  };

  const footer =
    mode === "reschedule" ? (
      <Button disabled={!when.time || isBusy} onClick={reschedule}>
        {isBusy ? "Переносим…" : when.time && when.date ? `Перенести на ${when.time}` : "Выберите время"}
      </Button>
    ) : mode === "cancel" ? (
      <div className="grid grid-cols-2 gap-2">
        <Button tone="secondary" disabled={isBusy} onClick={() => setMode("view")}>
          Оставить
        </Button>
        <Button
          tone="danger"
          disabled={isBusy}
          onClick={() => void run(() => api.cancel(booking.token), "Запись отменена.")}
        >
          {isBusy ? "Отменяем…" : "Отменить"}
        </Button>
      </div>
    ) : booking.canCancel ? (
      <div className="grid grid-cols-2 gap-2">
        <Button tone="danger" onClick={() => setMode("cancel")}>
          Отменить
        </Button>
        <Button
          disabled={!canReschedule}
          onClick={() => {
            setNotice(null);
            setWhen({ date: null, time: null });
            setMode("reschedule");
          }}
        >
          Перенести
        </Button>
      </div>
    ) : undefined;

  return (
    <Screen
      title={mode === "reschedule" ? "Новое время" : info.time}
      subtitle={mode === "reschedule" ? `Сейчас: ${info.dateLabel}, ${info.time}` : `${info.dateLabel} · ${statusLabels[booking.status]}`}
      onBack={isBusy ? undefined : back}
      footer={footer}
    >
      {notice && <Banner>{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {mode === "reschedule" ? (
        <WhenPicker
          key={pickerAttempt}
          serviceIds={booking.serviceIds}
          barberId={booking.barber.id}
          excludeToken={booking.token}
          value={when}
          onChange={(value) => {
            setError(null);
            setWhen(value);
          }}
        />
      ) : (
        <>
          {mode === "cancel" && (
            <Banner tone="error">
              Отменить запись? Время освободится для других клиентов, вернуть её будет нельзя.
            </Banner>
          )}
          <Section>
            <Row label="Мастер" value={booking.barber.name} />
            <Row label="Дата" value={info.dateLabel} />
            <Row label="Время" value={<span className="tabular-nums">{info.time}</span>} />
            <Row label="Длительность" value={formatDuration(booking.totalDurationMin)} />
          </Section>
          <Section title="Услуги">
            {booking.services.map((service) => (
              <Row
                key={`${service.serviceId}-${service.name}`}
                label={service.name}
                value={<span className="tabular-nums">{formatPrice(service.price)}</span>}
              />
            ))}
            <Row label="Итого" value={<span className="font-medium tabular-nums">{formatPrice(booking.totalPrice)}</span>} />
          </Section>
          {booking.status === "confirmed" && !booking.canCancel && (
            <p className="px-1 text-sm text-hint">
              До визита меньше {booking.cancelCutoffMin} минут — изменить запись можно только по телефону.
            </p>
          )}
        </>
      )}
    </Screen>
  );
}
