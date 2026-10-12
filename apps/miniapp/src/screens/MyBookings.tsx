import type { BookingView, MyBookings as MyBookingsData } from "@barbershop/shared";
import { useState } from "react";
import { BookingCard } from "../components/BookingCard";
import { Button, ErrorState, Screen, Skeleton } from "../components/ui";
import { errorMessage } from "../lib/api";
import type { RemoteState } from "../lib/use-remote";

type MyBookingsProps = {
  bookings: RemoteState<MyBookingsData> & { reload: () => void };
  onBack: () => void;
  onOpen: (booking: BookingView) => void;
  onBook: () => void;
};

export function MyBookings({ bookings, onBack, onOpen, onBook }: MyBookingsProps) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const list = bookings.data?.[tab] ?? [];

  return (
    <Screen title="Мои записи" onBack={onBack}>
      <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-section p-1">
        {(["upcoming", "past"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`h-9 rounded-lg text-sm transition-colors ${
              tab === item ? "bg-bg text-text shadow-sm" : "text-hint"
            }`}
          >
            {item === "upcoming" ? "Предстоящие" : "История"}
          </button>
        ))}
      </div>

      {bookings.status === "error" ? (
        <ErrorState message={errorMessage(bookings.error)} onRetry={bookings.reload} />
      ) : bookings.status !== "ready" ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl bg-section p-5">
          <p className="font-medium">{tab === "upcoming" ? "Записей пока нет" : "История пуста"}</p>
          <p className="mt-1 text-sm text-hint">
            {tab === "upcoming"
              ? "Выберите услугу и удобное время, это займёт минуту."
              : "Здесь появятся прошедшие и отменённые визиты."}
          </p>
          {tab === "upcoming" && (
            <Button className="mt-4" onClick={onBook}>
              Записаться
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((booking) => (
            <BookingCard key={booking.token} booking={booking} onOpen={() => onOpen(booking)} />
          ))}
        </div>
      )}
    </Screen>
  );
}
