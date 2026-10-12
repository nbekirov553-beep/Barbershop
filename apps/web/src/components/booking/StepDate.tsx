import {
  BOOKING_HORIZON_DAYS,
  addDays,
  formatMonth,
  getDayOfMonth,
  getWeekday,
} from "@/lib/booking";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export type DaysStatus = "loading" | "ready" | "error";

type StepDateProps = {
  today: string;
  status: DaysStatus;
  /** Дни, в которые есть хотя бы одно свободное окно. */
  available: Set<string>;
  selected: string | null;
  onSelect: (date: string) => void;
  onRetry: () => void;
};

export function StepDate({ today, status, available, selected, onSelect, onRetry }: StepDateProps) {
  const days = Array.from({ length: BOOKING_HORIZON_DAYS }, (_, index) => addDays(today, index));
  const offset = (getWeekday(today) + 6) % 7;
  const trailing = (7 - ((offset + days.length) % 7)) % 7;
  const isLoading = status === "loading";

  if (status === "error") {
    return (
      <div role="alert" className="border border-bone/15 p-6 sm:p-8">
        <p className="font-display text-xl font-light tracking-[-0.02em]">
          Не удалось загрузить календарь
        </p>
        <p className="mt-3 max-w-[44ch] text-sm text-ash">
          Проверьте соединение и попробуйте ещё раз. Выбранные услуги и мастер сохранены.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 flex h-12 items-center justify-center border border-bone/25 px-6 text-sm text-bone transition-colors duration-300 hover:border-tungsten hover:text-tungsten"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div aria-busy={isLoading}>
      <div className="grid grid-cols-7 gap-px border border-bone/10 bg-bone/10" role="group" aria-label="Дата">
        {weekdays.map((day) => (
          <span key={day} aria-hidden="true" className="bg-graphite py-3 text-center text-xs text-ash">
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" className="bg-graphite" />
        ))}
        {days.map((day, index) => {
          const isOff = !isLoading && !available.has(day);
          const isActive = day === selected;
          const dayNumber = getDayOfMonth(day);
          const showMonth = index === 0 || dayNumber === 1;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isActive}
              disabled={isOff || isLoading}
              onClick={() => onSelect(day)}
              aria-label={`${dayNumber} ${formatMonth(day)}${index === 0 ? ", сегодня" : ""}${isOff ? ", нет свободного времени" : ""}`}
              className={`relative flex aspect-square flex-col items-center justify-center text-sm tabular-nums transition-colors duration-200 sm:aspect-auto sm:h-16 ${
                isActive
                  ? "bg-tungsten text-graphite"
                  : isLoading
                    ? "animate-pulse bg-graphite-2 text-ash/50"
                    : isOff
                      ? "cursor-not-allowed bg-graphite text-ash/40 line-through"
                      : "bg-graphite-2 text-bone hover:bg-graphite-3"
              }`}
            >
              <span className="font-display text-base font-light sm:text-lg">{dayNumber}</span>
              {showMonth && (
                <span className={`text-[10px] ${isActive ? "text-graphite/70" : "text-ash"}`}>
                  {index === 0 ? "сегодня" : formatMonth(day)}
                </span>
              )}
            </button>
          );
        })}
        {Array.from({ length: trailing }, (_, index) => (
          <span key={`tail-${index}`} aria-hidden="true" className="bg-graphite" />
        ))}
      </div>
      <p className="mt-4 text-sm text-ash" aria-live="polite">
        {isLoading
          ? "Проверяем расписание мастеров"
          : "Зачёркнуты дни без свободного времени: выходные, отпуск или всё занято."}
      </p>
    </div>
  );
}
