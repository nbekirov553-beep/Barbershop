"use client";

import { useEffect, useState } from "react";
import type { AdminBarber, AdminBooking } from "@barbershop/shared";
import { fromMinutes, getWeekday, toMinutes, toZoned } from "@barbershop/shared/time";
import { localTime } from "@/components/admin/booking-dialogs";
import { statusLabels } from "@/components/admin/ui";
import { TIMEZONE } from "@/lib/booking";

const PX_PER_MIN = 1.4;
const DEFAULT_RANGE = { start: 10 * 60, end: 21 * 60 };

const blockStyles = {
  confirmed: "border-l-bone bg-graphite-3 hover:bg-[#222527]",
  completed: "border-l-ash/50 bg-graphite-2 text-ash hover:bg-graphite-3",
  no_show: "border-l-red-400/70 bg-graphite-2 text-ash hover:bg-graphite-3",
  cancelled: "hidden",
} as const;

function useNowMinutes(date: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const zoned = toZoned(new Date(), TIMEZONE);
      setNow(zoned.date === date ? zoned.minutes : null);
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [date]);
  return now;
}

export function DayBoard({
  date,
  barbers,
  bookings,
  onSelect,
}: {
  date: string;
  barbers: AdminBarber[];
  bookings: AdminBooking[];
  onSelect: (booking: AdminBooking) => void;
}) {
  const weekday = getWeekday(date);
  const now = useNowMinutes(date);
  const visible = bookings.filter((booking) => booking.status !== "cancelled");
  const columns = barbers.filter(
    (barber) => barber.isActive || visible.some((booking) => booking.barber.id === barber.id),
  );

  const hoursOf = (barber: AdminBarber) => barber.workingHours.find((item) => item.weekday === weekday);
  const edges = [
    ...columns.flatMap((barber) => {
      const hours = hoursOf(barber);
      return hours ? [toMinutes(hours.startTime), toMinutes(hours.endTime)] : [];
    }),
    ...visible.flatMap((booking) => [toMinutes(localTime(booking.startsAt)), toMinutes(localTime(booking.endsAt))]),
  ];
  const start = edges.length ? Math.floor(Math.min(...edges) / 60) * 60 : DEFAULT_RANGE.start;
  const end = edges.length ? Math.ceil(Math.max(...edges) / 60) * 60 : DEFAULT_RANGE.end;
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, index) => start + index * 60);
  const y = (minutes: number) => (minutes - start) * PX_PER_MIN;
  const height = y(end);

  if (columns.length === 0) return null;

  return (
    <div className="overflow-x-auto border border-bone/10">
      <div className="grid min-w-max pb-3" style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(10.5rem, 1fr))` }}>
        <div className="sticky left-0 z-20 border-b border-bone/10 bg-graphite" />
        {columns.map((barber) => (
          <div key={barber.id} className="border-b border-l border-bone/10 px-3 py-3">
            <p className="truncate text-sm font-medium">{barber.name}</p>
            <p className="text-xs text-ash tabular-nums">
              {hoursOf(barber) ? `${hoursOf(barber)!.startTime}–${hoursOf(barber)!.endTime}` : "Выходной"}
            </p>
          </div>
        ))}

        <div className="sticky left-0 z-20 bg-graphite" style={{ height }}>
          {hours.map((minutes) => (
            <span
              key={minutes}
              className="absolute right-2 -translate-y-1/2 text-xs text-ash tabular-nums first:translate-y-0"
              style={{ top: y(minutes) }}
            >
              {fromMinutes(minutes)}
            </span>
          ))}
        </div>

        {columns.map((barber) => {
          const working = hoursOf(barber);
          const breaks = barber.breaks.filter((item) => item.weekday === weekday);
          return (
            <div key={barber.id} className="relative border-l border-bone/10" style={{ height }}>
              {hours.map((minutes) => (
                <div key={minutes} className="absolute inset-x-0 border-t border-bone/[0.06]" style={{ top: y(minutes) }} />
              ))}
              {working ? (
                <>
                  <div className="absolute inset-x-0 top-0 bg-black/40" style={{ height: y(toMinutes(working.startTime)) }} />
                  <div
                    className="absolute inset-x-0 bottom-0 bg-black/40"
                    style={{ top: y(toMinutes(working.endTime)) }}
                  />
                </>
              ) : (
                <div className="absolute inset-0 bg-black/40" />
              )}
              {breaks.map((item) => (
                <div
                  key={item.startTime}
                  className="absolute inset-x-0 flex items-center bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(236_235_230/0.05)_6px_7px)] px-3 text-xs text-ash"
                  style={{ top: y(toMinutes(item.startTime)), height: (toMinutes(item.endTime) - toMinutes(item.startTime)) * PX_PER_MIN }}
                >
                  Обед
                </div>
              ))}
              {visible
                .filter((booking) => booking.barber.id === barber.id)
                .map((booking) => {
                  const from = toMinutes(localTime(booking.startsAt));
                  const blockHeight = Math.max(booking.totalDurationMin * PX_PER_MIN - 2, 28);
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => onSelect(booking)}
                      className={`absolute inset-x-1 z-10 overflow-hidden border-l-2 px-2.5 py-1.5 text-left transition-colors ${blockStyles[booking.status]}`}
                      style={{ top: y(from) + 1, height: blockHeight }}
                    >
                      <span className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                        <span>
                          {localTime(booking.startsAt)}–{localTime(booking.endsAt)}
                        </span>
                        {booking.status !== "confirmed" && <span className="text-ash">{statusLabels[booking.status]}</span>}
                      </span>
                      {blockHeight > 40 && <span className="block truncate text-sm font-medium">{booking.client.name}</span>}
                      {blockHeight > 64 && <span className="block truncate text-xs text-ash">{booking.services.join(", ")}</span>}
                    </button>
                  );
                })}
              {now !== null && now >= start && now <= end && (
                <div className="pointer-events-none absolute inset-x-0 z-20 h-px bg-tungsten" style={{ top: y(now) }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
