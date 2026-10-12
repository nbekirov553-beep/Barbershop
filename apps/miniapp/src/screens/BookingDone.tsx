import type { BookingView } from "@barbershop/shared";
import { formatPrice } from "@barbershop/shared/format";
import { Button, Row, Screen, Section } from "../components/ui";
import { describeBooking } from "../lib/booking";

type BookingDoneProps = { booking: BookingView; onMyBookings: () => void; onHome: () => void };

export function BookingDone({ booking, onMyBookings, onHome }: BookingDoneProps) {
  const info = describeBooking(booking);

  return (
    <Screen
      title={`Ждём вас, ${booking.client.name}`}
      subtitle="Запись подтверждена. Напомним о визите накануне."
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button tone="secondary" onClick={onHome}>
            На главную
          </Button>
          <Button onClick={onMyBookings}>Мои записи</Button>
        </div>
      }
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl text-on-accent">
        ✓
      </div>
      <Section>
        <Row label="Мастер" value={booking.barber.name} />
        <Row label="Дата" value={info.dateLabel} />
        <Row label="Время" value={<span className="tabular-nums">{info.time}</span>} />
        <Row label="Услуги" value={info.services} />
        <Row label="Итого" value={<span className="tabular-nums">{formatPrice(booking.totalPrice)}</span>} />
      </Section>
    </Screen>
  );
}
