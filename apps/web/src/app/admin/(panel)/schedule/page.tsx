"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { AdminBarber, AdminSchedule } from "@barbershop/shared";
import { toMinutes } from "@barbershop/shared/time";
import { Button, Checkbox, Empty, LoadState, Notice, PageHeader, inputClass } from "@/components/admin/ui";
import { adminApi, errorMessage } from "@/lib/admin-api";
import { useRemote } from "@/lib/use-remote";

const WEEK = [
  { weekday: 1, label: "Понедельник" },
  { weekday: 2, label: "Вторник" },
  { weekday: 3, label: "Среда" },
  { weekday: 4, label: "Четверг" },
  { weekday: 5, label: "Пятница" },
  { weekday: 6, label: "Суббота" },
  { weekday: 0, label: "Воскресенье" },
];

type Interval = { startTime: string; endTime: string };
type DayDraft = { isWorking: boolean; hours: Interval; breaks: Interval[] };

const toDraft = (barber: AdminBarber): Record<number, DayDraft> =>
  Object.fromEntries(
    WEEK.map(({ weekday }) => {
      const hours = barber.workingHours.find((item) => item.weekday === weekday);
      return [
        weekday,
        {
          isWorking: Boolean(hours),
          hours: hours ? { startTime: hours.startTime, endTime: hours.endTime } : { startTime: "10:00", endTime: "21:00" },
          breaks: barber.breaks
            .filter((item) => item.weekday === weekday)
            .map((item) => ({ startTime: item.startTime, endTime: item.endTime })),
        },
      ];
    }),
  );

function dayError(day: DayDraft): string | null {
  if (!day.isWorking) return null;
  if (toMinutes(day.hours.startTime) >= toMinutes(day.hours.endTime)) return "Начало дня позже конца";
  for (const item of day.breaks) {
    if (toMinutes(item.startTime) >= toMinutes(item.endTime)) return "Обед заканчивается раньше, чем начинается";
    if (toMinutes(item.startTime) < toMinutes(day.hours.startTime) || toMinutes(item.endTime) > toMinutes(day.hours.endTime)) {
      return "Обед выходит за рабочие часы";
    }
  }
  return null;
}

function TimeInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <input
      type="time"
      step={300}
      aria-label={label}
      disabled={disabled}
      className={`${inputClass.replace("w-full", "w-28")} h-10 tabular-nums`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ScheduleEditor({ barber, onSaved }: { barber: AdminBarber; onSaved: () => void }) {
  const [days, setDays] = useState(() => toDraft(barber));
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const update = (weekday: number, patch: (day: DayDraft) => DayDraft) =>
    setDays((current) => ({ ...current, [weekday]: patch(current[weekday]) }));
  const hasErrors = WEEK.some(({ weekday }) => dayError(days[weekday]) !== null);

  const save = async () => {
    setIsBusy(true);
    setStatus(null);
    const working = WEEK.filter(({ weekday }) => days[weekday].isWorking);
    const schedule: AdminSchedule = {
      workingHours: working.map(({ weekday }) => ({ weekday, ...days[weekday].hours })),
      breaks: working.flatMap(({ weekday }) => days[weekday].breaks.map((item) => ({ weekday, ...item }))),
    };
    try {
      await adminApi.updateSchedule(barber.id, schedule);
      setStatus({ tone: "success", text: "График сохранён. Уже сделанные записи не меняются." });
      onSaved();
    } catch (failure) {
      setStatus({ tone: "error", text: errorMessage(failure) });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <ul className="divide-y divide-bone/10 border-y border-bone/10">
        {WEEK.map(({ weekday, label }) => {
          const day = days[weekday];
          const error = dayError(day);
          return (
            <li key={weekday} className="grid gap-3 py-4 md:grid-cols-[11rem_auto_1fr] md:items-start">
              <div className="pt-2">
                <Checkbox
                  checked={day.isWorking}
                  onChange={(value) => update(weekday, (current) => ({ ...current, isWorking: value }))}
                  label={label}
                />
              </div>
              {day.isWorking ? (
                <>
                  <div className="flex items-center gap-2">
                    <TimeInput
                      label={`${label}: начало`}
                      value={day.hours.startTime}
                      onChange={(value) => update(weekday, (current) => ({ ...current, hours: { ...current.hours, startTime: value } }))}
                    />
                    <span className="text-ash">–</span>
                    <TimeInput
                      label={`${label}: конец`}
                      value={day.hours.endTime}
                      onChange={(value) => update(weekday, (current) => ({ ...current, hours: { ...current.hours, endTime: value } }))}
                    />
                  </div>
                  <div className="space-y-2 md:pl-6">
                    {day.breaks.map((item, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <span className="w-12 text-sm text-ash">Обед</span>
                        <TimeInput
                          label={`${label}: начало обеда`}
                          value={item.startTime}
                          onChange={(value) =>
                            update(weekday, (current) => ({
                              ...current,
                              breaks: current.breaks.map((entry, position) => (position === index ? { ...entry, startTime: value } : entry)),
                            }))
                          }
                        />
                        <span className="text-ash">–</span>
                        <TimeInput
                          label={`${label}: конец обеда`}
                          value={item.endTime}
                          onChange={(value) =>
                            update(weekday, (current) => ({
                              ...current,
                              breaks: current.breaks.map((entry, position) => (position === index ? { ...entry, endTime: value } : entry)),
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            update(weekday, (current) => ({
                              ...current,
                              breaks: current.breaks.filter((_, position) => position !== index),
                            }))
                          }
                        >
                          Убрать
                        </Button>
                      </div>
                    ))}
                    {day.breaks.length < 3 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="-ml-3"
                        onClick={() =>
                          update(weekday, (current) => ({
                            ...current,
                            breaks: [...current.breaks, { startTime: "14:00", endTime: "15:00" }],
                          }))
                        }
                      >
                        Добавить обед
                      </Button>
                    )}
                    {error && <p className="text-sm text-red-300">{error}</p>}
                  </div>
                </>
              ) : (
                <p className="pt-2 text-sm text-ash md:col-span-2">Выходной</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button variant="primary" disabled={isBusy || hasErrors} onClick={save}>
          {isBusy ? "Сохраняем…" : "Сохранить график"}
        </Button>
        {status && <Notice tone={status.tone}>{status.text}</Notice>}
      </div>
    </>
  );
}

function SchedulePage() {
  const router = useRouter();
  const params = useSearchParams();
  const barbers = useRemote("barbers", adminApi.barbers);
  const selectedId = params.get("barber") ?? barbers.data?.[0]?.id;
  const barber = barbers.data?.find((item) => item.id === selectedId);

  return (
    <>
      <PageHeader
        title="График"
        description="Постоянные рабочие часы и обеды. Разовые выходные, отпуска и праздники задаются в «Исключениях»."
      />
      {barbers.status !== "ready" && !barbers.data ? (
        <LoadState status={barbers.status === "error" ? "error" : "loading"} onRetry={barbers.reload} />
      ) : !barbers.data || barbers.data.length === 0 ? (
        <Empty>Сначала добавьте мастера.</Empty>
      ) : (
        <>
          <div className="mb-8 flex gap-1 overflow-x-auto" role="tablist" aria-label="Мастер">
            {barbers.data.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === barber?.id}
                onClick={() => router.replace(`/admin/schedule?barber=${item.id}`, { scroll: false })}
                className={`h-10 shrink-0 border px-4 text-sm transition-colors ${
                  item.id === barber?.id ? "border-bone bg-bone text-graphite" : "border-bone/15 text-ash hover:text-bone"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
          {barber && <ScheduleEditor key={barber.id} barber={barber} onSaved={barbers.reload} />}
        </>
      )}
    </>
  );
}

export default function AdminSchedulePage() {
  return (
    <Suspense>
      <SchedulePage />
    </Suspense>
  );
}
