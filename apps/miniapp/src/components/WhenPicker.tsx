import { formatMonth, getDayOfMonth } from "@barbershop/shared/format";
import { getWeekday } from "@barbershop/shared/time";
import { api, errorMessage } from "../lib/api";
import { haptic } from "../lib/telegram";
import { useRemote } from "../lib/use-remote";
import { ErrorState, Skeleton } from "./ui";

const weekdays = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export type When = { date: string | null; time: string | null };

type WhenPickerProps = {
  serviceIds: string[];
  barberId: string;
  /** При переносе: время самой записи не считается занятым. */
  excludeToken?: string;
  value: When;
  onChange: (value: When) => void;
};

export function WhenPicker({ serviceIds, barberId, excludeToken, value, onChange }: WhenPickerProps) {
  const query = { serviceIds, barberId, excludeToken };
  const days = useRemote(`${serviceIds.join(",")}|${barberId}`, () => api.days(query));

  const available = days.data?.days.filter((day) => day.available).map((day) => day.date) ?? [];
  const activeDate = value.date && available.includes(value.date) ? value.date : (available[0] ?? null);

  const slots = useRemote(activeDate && `${serviceIds.join(",")}|${barberId}|${activeDate}`, () =>
    api.slots({ ...query, date: activeDate! }),
  );

  if (days.status === "error") return <ErrorState message={errorMessage(days.error)} onRetry={days.reload} />;

  if (days.status !== "ready") {
    return (
      <div aria-busy="true">
        <div className="-mx-4 flex gap-2 overflow-hidden px-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[4.5rem] w-14 shrink-0" />
          ))}
        </div>
        <Skeleton className="mt-6 h-40" />
      </div>
    );
  }

  if (!activeDate) {
    return (
      <div className="rounded-2xl bg-section p-5">
        <p className="font-medium">Свободного времени нет</p>
        <p className="mt-1 text-sm text-hint">
          В ближайшие 30 дней у мастера всё занято. Выберите другого мастера или «Любой свободный».
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="День"
        className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      >
        {days.data.days.map((day, index) => {
          const isActive = day.date === activeDate;
          const dayNumber = getDayOfMonth(day.date);
          return (
            <button
              key={day.date}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={!day.available}
              onClick={() => {
                haptic.select();
                onChange({ date: day.date, time: null });
              }}
              className={`flex h-[4.5rem] w-14 shrink-0 snap-start flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                isActive
                  ? "bg-accent text-on-accent"
                  : day.available
                    ? "bg-section text-text"
                    : "bg-transparent text-hint/50 line-through"
              }`}
            >
              <span className={`text-[11px] ${isActive ? "opacity-80" : "text-hint"}`}>
                {index === 0 ? "Сег" : weekdays[getWeekday(day.date)]}
              </span>
              <span className="font-display text-lg leading-tight font-light">{dayNumber}</span>
              {(index === 0 || dayNumber === 1) && (
                <span className={`text-[10px] ${isActive ? "opacity-80" : "text-hint"}`}>{formatMonth(day.date)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {slots.status === "error" ? (
          <ErrorState message={errorMessage(slots.error)} onRetry={slots.reload} />
        ) : slots.status !== "ready" ? (
          <div className="grid grid-cols-4 gap-2" aria-busy="true">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : slots.data.slots.length === 0 ? (
          <p className="rounded-2xl bg-section p-5 text-sm text-hint">
            На этот день всё занято. Выберите другой день.
          </p>
        ) : (
          <div role="radiogroup" aria-label="Время" className="grid grid-cols-4 gap-2">
            {slots.data.slots.map((time) => {
              const isActive = value.date === activeDate && value.time === time;
              return (
                <button
                  key={time}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => {
                    haptic.select();
                    onChange({ date: activeDate, time });
                  }}
                  className={`h-11 rounded-xl text-[15px] tabular-nums transition-colors ${
                    isActive ? "bg-accent text-on-accent" : "bg-section text-text"
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-hint">Время по Ташкенту.</p>
    </div>
  );
}