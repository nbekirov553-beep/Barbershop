import type { BookingStatus, BookingView } from "@barbershop/shared";
import { formatDateLong } from "@barbershop/shared/format";
import { toZoned } from "@barbershop/shared/time";

export const statusLabels: Record<BookingStatus, string> = {
  confirmed: "Подтверждена",
  completed: "Состоялась",
  cancelled: "Отменена",
  no_show: "Пропущена",
};

export function describeBooking(booking: BookingView) {
  const start = toZoned(new Date(booking.startsAt), booking.timezone);
  const end = toZoned(new Date(booking.endsAt), booking.timezone);
  return {
    date: start.date,
    dateLabel: formatDateLong(start.date),
    time: `${start.time}–${end.time}`,
    services: booking.services.map((service) => service.name).join(", "),
  };
}
