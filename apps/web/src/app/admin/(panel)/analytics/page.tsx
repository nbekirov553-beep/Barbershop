"use client";

import { useState, type ReactNode } from "react";
import type { AnalyticsQuery } from "@barbershop/shared";
import { formatDateLong, formatPrice, pluralize } from "@barbershop/shared/format";
import { addDays } from "@barbershop/shared/time";
import { BarRow, Heatmap, RevenueChart, compactMoney, hours, percent } from "@/components/admin/analytics-charts";
import { Field, LoadState, PageHeader, inputClass } from "@/components/admin/ui";
import { adminApi, type AnalyticsResponses } from "@/lib/admin-api";
import { getTashkentToday } from "@/lib/booking";
import { useRemote } from "@/lib/use-remote";

type Preset = "7" | "30" | "90" | "month" | "prev-month" | "custom";

const presets: { value: Preset; label: string }[] = [
  { value: "7", label: "7 дней" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
  { value: "month", label: "Этот месяц" },
  { value: "prev-month", label: "Прошлый месяц" },
  { value: "custom", label: "Свой период" },
];

function presetRange(preset: Exclude<Preset, "custom">, today: string) {
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (preset === "prev-month") {
    const lastDay = addDays(`${today.slice(0, 8)}01`, -1);
    return { from: `${lastDay.slice(0, 8)}01`, to: lastDay };
  }
  return { from: addDays(today, -(Number(preset) - 1)), to: today };
}

function useAnalytics<K extends keyof AnalyticsResponses>(kind: K, params: AnalyticsQuery | null) {
  const key = params ? `analytics:${kind}:${params.from}:${params.to}:${params.barberId ?? ""}` : null;
  return useRemote(key, () => adminApi.analytics(kind, params!));
}

function Panel({ title, description, children, className = "" }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`border-t border-bone/10 pt-6 ${className}`}>
      <h2 className="font-display text-base font-medium">{title}</h2>
      {description && <p className="mt-1 text-sm text-ash">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="py-5 xl:px-6 xl:first:pl-0">
      <p className="text-sm text-ash">{label}</p>
      <p className="mt-2 font-display text-2xl font-medium tracking-tight tabular-nums lg:text-[1.75rem]">{value}</p>
      {note && <p className="mt-1.5 text-xs text-ash tabular-nums">{note}</p>}
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <>в прошлом периоде данных нет</>;
  const change = (current - previous) / previous;
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return (
    <>
      <span className={change < 0 ? "text-red-300" : "text-bone"}>
        {sign}
        {percent(Math.abs(change))}
      </span>{" "}
      к прошлому периоду
    </>
  );
}

const Skeleton = ({ className }: { className: string }) => <div className={`animate-pulse bg-graphite-2 ${className}`} />;

export default function AdminAnalyticsPage() {
  const today = getTashkentToday();
  const [preset, setPreset] = useState<Preset>("30");
  const [custom, setCustom] = useState(() => presetRange("30", today));
  const [barberId, setBarberId] = useState("");

  const range = preset === "custom" ? custom : presetRange(preset, today);
  const isValid = range.from <= range.to;
  const params: AnalyticsQuery | null = isValid ? { ...range, barberId: barberId || undefined } : null;

  const barbers = useRemote("barbers", adminApi.barbers);
  const revenue = useAnalytics("revenue", params);
  const services = useAnalytics("services", params);
  const load = useAnalytics("load", params);
  const heatmap = useAnalytics("heatmap", params);
  const cancellations = useAnalytics("cancellations", params);
  const retention = useAnalytics("retention", params);

  const all = [revenue, services, load, heatmap, cancellations, retention];
  const failed = all.some((item) => item.status === "error");
  const reloadAll = () => all.forEach((item) => item.reload());

  const topService = Math.max(...(services.data?.services.map((item) => item.bookings) ?? [1]), 1);
  const sources = revenue.data?.bookings.bySource;

  return (
    <>
      <PageHeader
        title="Аналитика"
        description={isValid ? `${formatDateLong(range.from)} – ${formatDateLong(range.to)}. Выручка считается по завершённым визитам.` : undefined}
      />

      <div className="mb-10 flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Период">
          {presets.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={preset === item.value}
              onClick={() => {
                if (item.value === "custom" && preset !== "custom") setCustom(range);
                setPreset(item.value);
              }}
              className={`h-10 border px-4 text-sm transition-colors ${
                preset === item.value ? "border-bone bg-bone text-graphite" : "border-bone/15 text-ash hover:text-bone"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-3">
            <Field label="С">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  max={custom.to}
                  className={`${inputClass} h-10`}
                  value={custom.from}
                  onChange={(event) => setCustom((current) => ({ ...current, from: event.target.value }))}
                />
              )}
            </Field>
            <Field label="По">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  min={custom.from}
                  className={`${inputClass} h-10`}
                  value={custom.to}
                  onChange={(event) => setCustom((current) => ({ ...current, to: event.target.value }))}
                />
              )}
            </Field>
          </div>
        )}
        <Field label="Мастер" className="w-full sm:w-56">
          {(id) => (
            <select id={id} className={`${inputClass} h-10`} value={barberId} onChange={(event) => setBarberId(event.target.value)}>
              <option value="">Весь салон</option>
              {barbers.data?.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {!isValid ? (
        <p className="text-sm text-red-300">Конец периода раньше начала.</p>
      ) : failed ? (
        <LoadState status="error" onRetry={reloadAll} />
      ) : (
        <div className="space-y-14">
          <div className="grid border-y border-bone/10 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-bone/10">
            {revenue.data && cancellations.data ? (
              <>
                <Metric
                  label="Выручка"
                  value={`${compactMoney(revenue.data.revenue)} сум`}
                  note={
                    <>
                      {formatPrice(revenue.data.revenue)}
                      <br />
                      <Delta current={revenue.data.revenue} previous={revenue.data.previous.revenue} />
                    </>
                  }
                />
                <Metric
                  label="Визиты"
                  value={String(revenue.data.completed)}
                  note={`средний чек ${formatPrice(revenue.data.averageCheck)}`}
                />
                <Metric
                  label="Записи"
                  value={String(revenue.data.bookings.total)}
                  note={<Delta current={revenue.data.bookings.total} previous={revenue.data.previous.bookings} />}
                />
                <Metric
                  label="Отмены и неявки"
                  value={`${percent(cancellations.data.cancelRate)} / ${percent(cancellations.data.noShowRate)}`}
                  note={`${pluralize(cancellations.data.cancelled, ["отмена", "отмены", "отмен"])}, ${pluralize(cancellations.data.noShow, ["неявка", "неявки", "неявок"])}`}
                />
              </>
            ) : (
              [0, 1, 2, 3].map((item) => <Skeleton key={item} className="m-5 h-20" />)
            )}
          </div>

          <Panel title="Выручка по дням" description="Наведите на столбец, чтобы увидеть сумму и число визитов.">
            {revenue.data ? (
              <>
                <RevenueChart days={revenue.data.days} />
                <p className="mt-4 text-xs text-ash tabular-nums">
                  Прошлый период ({formatDateLong(revenue.data.previous.from)} – {formatDateLong(revenue.data.previous.to)}):{" "}
                  {formatPrice(revenue.data.previous.revenue)}, {pluralize(revenue.data.previous.completed, ["визит", "визита", "визитов"])}
                </p>
              </>
            ) : (
              <Skeleton className="h-60" />
            )}
          </Panel>

          <div className="grid gap-14 lg:grid-cols-2 lg:gap-12">
            <Panel title="Популярные услуги" description="По числу записей без отмен. Сумма — по завершённым визитам.">
              {services.data ? (
                services.data.services.length ? (
                  <ul className="divide-y divide-bone/10">
                    {services.data.services.slice(0, 8).map((item) => (
                      <BarRow
                        key={item.key}
                        label={item.name}
                        value={pluralize(item.bookings, ["запись", "записи", "записей"])}
                        share={item.bookings / topService}
                        detail={`${compactMoney(item.revenue)} сум выручки`}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ash">В этом периоде записей нет.</p>
                )
              ) : (
                <Skeleton className="h-64" />
              )}
            </Panel>

            <Panel title="Загрузка мастеров" description="Занятое время к рабочему по графику без обедов и исключений.">
              {load.data ? (
                <ul className="divide-y divide-bone/10">
                  {load.data.barbers.map((item) => (
                    <BarRow
                      key={item.barberId}
                      label={item.name}
                      value={item.utilization === null ? "не работал" : percent(item.utilization)}
                      share={item.utilization ?? 0}
                      muted={item.utilization === null}
                      detail={`${hours(item.bookedMin)} из ${hours(item.availableMin)}, ${pluralize(item.bookings, ["запись", "записи", "записей"])}, ${compactMoney(item.revenue)} сум`}
                    />
                  ))}
                </ul>
              ) : (
                <Skeleton className="h-64" />
              )}
            </Panel>
          </div>

          <Panel title="Когда салон загружен" description="Среднее занятое время мастеров по дням недели и часам.">
            {heatmap.data ? <Heatmap data={heatmap.data} /> : <Skeleton className="h-64" />}
          </Panel>

          <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
            <Panel title="Отмены и неявки" description="Доля неявок считается от визитов, время которых уже прошло.">
              {cancellations.data ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="border-b border-bone/10 text-left text-xs text-ash">
                        <th className="py-2 pr-4 font-normal">Мастер</th>
                        <th className="py-2 pr-4 text-right font-normal">Записей</th>
                        <th className="py-2 pr-4 text-right font-normal">Отмены</th>
                        <th className="py-2 text-right font-normal">Неявки</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bone/10">
                      {cancellations.data.barbers.map((item) => (
                        <tr key={item.barberId}>
                          <td className="py-3 pr-4">{item.name}</td>
                          <td className="py-3 pr-4 text-right">{item.total}</td>
                          <td className="py-3 pr-4 text-right">
                            {item.cancelled}
                            <span className="ml-2 text-xs text-ash">{percent(item.total ? item.cancelled / item.total : 0)}</span>
                          </td>
                          <td className="py-3 text-right">
                            {item.noShow}
                            <span className="ml-2 text-xs text-ash">
                              {percent(item.completed + item.noShow ? item.noShow / (item.completed + item.noShow) : 0)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Skeleton className="h-48" />
              )}
            </Panel>

            <Panel title="Возвращаемость" description="Клиенты с завершённым визитом в периоде.">
              {retention.data ? (
                retention.data.clients ? (
                  <>
                    <p className="font-display text-3xl font-medium tabular-nums">{percent(retention.data.returningRate)}</p>
                    <p className="mt-1 text-sm text-ash">
                      {pluralize(retention.data.returningClients, ["клиент вернулся", "клиента вернулись", "клиентов вернулись"])} из{" "}
                      {retention.data.clients}
                    </p>
                    <div className="mt-5 flex h-2">
                      <div className="bg-bone/80" style={{ width: `${retention.data.returningRate * 100}%` }} />
                      <div className="flex-1 bg-bone/15" />
                    </div>
                    <dl className="mt-5 grid grid-cols-[1fr_auto] gap-y-2 text-sm tabular-nums">
                      <dt className="text-ash">Постоянные, были раньше</dt>
                      <dd>{retention.data.returningClients}</dd>
                      <dt className="text-ash">Новые</dt>
                      <dd>{retention.data.newClients}</dd>
                      <dt className="text-ash">Новые, пришли повторно</dt>
                      <dd>{retention.data.newRepeated}</dd>
                    </dl>
                  </>
                ) : (
                  <p className="text-sm text-ash">В этом периоде завершённых визитов нет.</p>
                )
              ) : (
                <Skeleton className="h-48" />
              )}
            </Panel>
          </div>

          {sources && revenue.data && (
            <Panel title="Откуда записываются">
              <ul className="grid gap-x-12 divide-y divide-bone/10 sm:grid-cols-3 sm:divide-y-0">
                {(
                  [
                    ["telegram", "Telegram"],
                    ["web", "Сайт"],
                    ["admin", "Админка и звонки"],
                  ] as const
                ).map(([key, label]) => (
                  <BarRow
                    key={key}
                    label={label}
                    value={String(sources[key])}
                    share={revenue.data.bookings.total ? sources[key] / revenue.data.bookings.total : 0}
                    detail={percent(revenue.data.bookings.total ? sources[key] / revenue.data.bookings.total : 0)}
                  />
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
