import type { AnalyticsHeatmap, AnalyticsRevenue } from "@barbershop/shared";
import { formatDateLong, formatPrice, pluralize } from "@barbershop/shared/format";
import { fromMinutes } from "@barbershop/shared/time";

export const percent = (value: number) => `${(Math.round(value * 1000) / 10).toLocaleString("ru-RU")}%`;

export const hours = (minutes: number) => {
  const value = Math.round(minutes / 6) / 10;
  return `${value.toLocaleString("ru-RU")} ч`;
};

/** «12,5 млн» для подписей осей и компактных цифр. */
export function compactMoney(value: number) {
  if (value >= 1_000_000) return `${(Math.round(value / 100_000) / 10).toLocaleString("ru-RU")} млн`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString("ru-RU")} тыс`;
  return value.toLocaleString("ru-RU");
}

const dayMonth = (date: string) => `${Number(date.slice(8, 10))}.${date.slice(5, 7)}`;

export function RevenueChart({ days }: { days: AnalyticsRevenue["days"] }) {
  const max = Math.max(...days.map((day) => day.revenue), 1);
  const labelEvery = Math.ceil(days.length / 8);

  return (
    <div>
      <div className="flex h-56 items-end gap-px border-b border-bone/15" role="img" aria-label="Выручка по дням">
        {days.map((day) => (
          <div key={day.date} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full bg-bone/70 transition-colors group-hover:bg-bone"
              style={{ height: `${(day.revenue / max) * 100}%`, minHeight: day.revenue > 0 ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 border border-bone/15 bg-graphite px-3 py-2 text-xs whitespace-nowrap group-hover:block">
              <p className="text-ash">{formatDateLong(day.date)}</p>
              <p className="mt-1 tabular-nums">{formatPrice(day.revenue)}</p>
              <p className="text-ash tabular-nums">
                {pluralize(day.completed, ["визит", "визита", "визитов"])}, {pluralize(day.bookings, ["запись", "записи", "записей"])}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-px text-[11px] text-ash tabular-nums">
        {days.map((day, index) => (
          <span key={day.date} className="flex-1 overflow-visible whitespace-nowrap">
            {index % labelEvery === 0 ? dayMonth(day.date) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarRow({
  label,
  value,
  share,
  detail,
  muted = false,
}: {
  label: string;
  value: string;
  share: number;
  detail?: string;
  muted?: boolean;
}) {
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums">{value}</span>
      </div>
      <div className="mt-2 h-1.5 bg-bone/[0.07]">
        <div className={`h-full ${muted ? "bg-ash/60" : "bg-bone/80"}`} style={{ width: `${Math.min(share, 1) * 100}%` }} />
      </div>
      {detail && <p className="mt-1.5 text-xs text-ash tabular-nums">{detail}</p>}
    </li>
  );
}

const WEEK = [
  { weekday: 1, label: "Пн" },
  { weekday: 2, label: "Вт" },
  { weekday: 3, label: "Ср" },
  { weekday: 4, label: "Чт" },
  { weekday: 5, label: "Пт" },
  { weekday: 6, label: "Сб" },
  { weekday: 0, label: "Вс" },
];

/** Средние занятые минуты на день недели и час: так периоды разной длины сравнимы. */
export function Heatmap({ data }: { data: AnalyticsHeatmap }) {
  const average = (weekday: number, hour: number) =>
    data.weekdayCount[weekday] ? data.minutes[weekday][hour] / data.weekdayCount[weekday] : 0;
  const used = Array.from({ length: 24 }, (_, hour) => hour).filter((hour) =>
    WEEK.some(({ weekday }) => data.minutes[weekday][hour] > 0),
  );
  const first = used.length ? Math.min(...used) : 10;
  const last = used.length ? Math.max(...used) : 20;
  const range = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const max = Math.max(...WEEK.flatMap(({ weekday }) => range.map((hour) => average(weekday, hour))), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-separate border-spacing-[3px] text-xs">
        <thead>
          <tr>
            <th className="w-8" />
            {range.map((hour) => (
              <th key={hour} scope="col" className="pb-1 text-left font-normal text-ash tabular-nums">
                {hour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEK.map(({ weekday, label }) => (
            <tr key={weekday}>
              <th scope="row" className="pr-2 text-left font-normal text-ash">
                {label}
              </th>
              {range.map((hour) => {
                const value = average(weekday, hour);
                const starts = data.starts[weekday][hour];
                return (
                  <td
                    key={hour}
                    title={`${label}, ${fromMinutes(hour * 60)}–${fromMinutes((hour + 1) * 60)}: в среднем ${Math.round(value)} мин работы мастеров, ${pluralize(starts, ["запись начиналась", "записи начинались", "записей начиналось"])} за период`}
                    className="h-8 min-w-6 bg-bone"
                    style={{ opacity: value > 0 ? 0.08 + (value / max) * 0.82 : 0.04 }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2 text-xs text-ash">
        <span>Свободно</span>
        <span className="flex h-2 w-24">
          {[0.04, 0.25, 0.45, 0.65, 0.9].map((opacity) => (
            <span key={opacity} className="flex-1 bg-bone" style={{ opacity }} />
          ))}
        </span>
        <span>Плотно</span>
      </div>
    </div>
  );
}
