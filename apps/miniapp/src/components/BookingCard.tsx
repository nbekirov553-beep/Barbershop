import type { BookingView } from "@barbershop/shared";
import { formatPrice } from "@barbershop/shared/format";
import { describeBooking, statusLabels } from "../lib/booking";

type BookingCardProps = { booking: BookingView; onOpen: () => void; highlight?: boolean };

export function BookingCard({ booking, onOpen, highlight = false }: BookingCardProps) {
  const info = describeBooking(booking);
  const isActive = booking.status === "confirmed";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full rounded-2xl p-4 text-left transition-transform active:scale-[0.99] ${
        highlight ? "bg-accent text-on-accent" : "bg-section"
      }`}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-display text-xl font-light tracking-[-0.02em] tabular-nums">{info.time}</span>
        <span className={`text-xs ${highlight ? "opacity-75" : isActive ? "text-link" : "text-hint"}`}>
          {statusLabels[booking.status]}
        </span>
      </span>
      <span className={`mt-1 block text-sm ${highlight ? "opacity-85" : "text-hint"}`}>
        {info.dateLabel} · {booking.barber.name}
      </span>
      <span className={`mt-3 flex justify-between gap-3 text-sm ${highlight ? "" : "text-text"}`}>
        <span className="truncate">{info.services}</span>
        <span className="shrink-0 tabular-nums">{formatPrice(booking.totalPrice)}</span>
      </span>
    </button>
  );
}
