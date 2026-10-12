import type { BookingView, MyBookings } from "@barbershop/shared";
import { pluralize } from "@barbershop/shared/format";
import { shop } from "@barbershop/shared/shop";
import { BookingCard } from "../components/BookingCard";
import { Button, Skeleton } from "../components/ui";
import type { RemoteState } from "../lib/use-remote";

type HomeProps = {
  firstName: string;
  bookings: RemoteState<MyBookings>;
  onBook: () => void;
  onMyBookings: () => void;
  onOpen: (booking: BookingView) => void;
};

export function Home({ firstName, bookings, onBook, onMyBookings, onOpen }: HomeProps) {
  const upcoming = bookings.data?.upcoming ?? [];
  const next = upcoming[0];

  return (
    <div className="flex min-h-[var(--tg-viewport-stable-height,100svh)] animate-enter flex-col px-4 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <p className="font-display text-sm tracking-[0.35em] text-hint">USTO</p>
      <h1 className="mt-8 font-display text-[2.4rem] leading-[1.05] font-light tracking-[-0.04em]">
        {firstName ? `Салам, ${firstName}` : "Салам"}
      </h1>
      <p className="mt-3 max-w-[30ch] text-[15px] text-hint">
        Мужская парикмахерская у метро «Космонавтлар». Запись за минуту, без звонков.
      </p>

      <div className="mt-8">
        {bookings.status === "loading" ? (
          <Skeleton className="h-28" />
        ) : next ? (
          <>
            <p className="mb-2 px-1 text-xs tracking-wide text-hint uppercase">Ближайший визит</p>
            <BookingCard booking={next} highlight onOpen={() => onOpen(next)} />
          </>
        ) : null}
      </div>

      <div className="mt-auto space-y-2 pt-10">
        <Button onClick={onBook}>Записаться</Button>
        <Button tone="secondary" onClick={onMyBookings}>
          Мои записи
          {upcoming.length > 0 && (
            <span className="ml-2 text-hint">{pluralize(upcoming.length, ["активная", "активные", "активных"])}</span>
          )}
        </Button>
        <div className="flex justify-between gap-4 px-1 pt-4 text-xs text-hint">
          <span>{shop.address}</span>
          <span className="text-right tabular-nums">
            {shop.hours.map((item) => `${item.days} ${item.time}`).join(" · ")}
          </span>
        </div>
      </div>
    </div>
  );
}
