import { getEndTime } from "@/lib/booking";
import { formatDuration } from "@/lib/format";

export type SlotsStatus = "loading" | "ready" | "error";

type StepTimeProps = {
  status: SlotsStatus;
  slots: string[];
  selected: string | null;
  durationMin: number;
  onSelect: (time: string) => void;
  onRetry: () => void;
  onChangeDate: () => void;
  onAnyBarber?: () => void;
};

const secondaryButton =
  "flex h-12 items-center justify-center border border-bone/25 px-6 text-sm text-bone transition-colors duration-300 hover:border-tungsten hover:text-tungsten";

export function StepTime({
  status,
  slots,
  selected,
  durationMin,
  onSelect,
  onRetry,
  onChangeDate,
  onAnyBarber,
}: StepTimeProps) {
  if (status === "loading") {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Загружаем свободное время</span>
        <div className="grid grid-cols-3 gap-px border border-bone/10 bg-bone/10 sm:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className="h-16 animate-pulse bg-graphite-2" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="border border-bone/15 p-6 sm:p-8">
        <p className="font-display text-xl font-light tracking-[-0.02em]">
          Не удалось загрузить расписание
        </p>
        <p className="mt-3 max-w-[44ch] text-sm text-ash">
          Проверьте соединение и попробуйте ещё раз. Выбранные услуги и мастер сохранены.
        </p>
        <button type="button" onClick={onRetry} className={`${secondaryButton} mt-6`}>
          Повторить
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="border border-bone/15 p-6 sm:p-8">
        <p className="font-display text-xl font-light tracking-[-0.02em]">
          На этот день свободного времени нет
        </p>
        <p className="mt-3 max-w-[44ch] text-sm text-ash">
          Выберите другой день{onAnyBarber ? " или посмотрите окна у всех мастеров" : ""}.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onChangeDate} className={secondaryButton}>
            Выбрать другой день
          </button>
          {onAnyBarber && (
            <button type="button" onClick={onAnyBarber} className={secondaryButton}>
              Любой свободный мастер
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Время"
        className="grid grid-cols-3 border-t border-l border-bone/10 sm:grid-cols-4"
      >
        {slots.map((time) => {
          const isActive = time === selected;
          return (
            <button
              key={time}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onSelect(time)}
              className={`flex h-16 flex-col items-center justify-center border-r border-b border-bone/10 tabular-nums transition-colors duration-200 ${
                isActive ? "bg-tungsten text-graphite" : "bg-graphite-2 text-bone hover:bg-graphite-3"
              }`}
            >
              <span className="font-display text-lg font-light">{time}</span>
              {isActive && (
                <span className="text-[11px] text-graphite/70">
                  до {getEndTime(time, durationMin)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-ash">
        Время указано по Ташкенту. Визит займёт около {formatDuration(durationMin)}.
      </p>
    </div>
  );
}
