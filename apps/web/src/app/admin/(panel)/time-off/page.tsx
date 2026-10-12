"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { AdminBarber, AdminTimeOff, AdminTimeOffInput, TimeOffType } from "@barbershop/shared";
import { formatDateLong, pluralize } from "@barbershop/shared/format";
import { addDays } from "@barbershop/shared/time";
import { Button, Dialog, Empty, Field, LoadState, Notice, PageHeader, inputClass } from "@/components/admin/ui";
import { adminApi, errorMessage } from "@/lib/admin-api";
import { getTashkentToday } from "@/lib/booking";
import { useRemote } from "@/lib/use-remote";

const typeLabels: Record<TimeOffType, string> = {
  day_off: "Выходной",
  vacation: "Отпуск",
  sick_leave: "Больничный",
  holiday: "Праздник",
};

const SALON = "salon";

function formatRange(item: { from: string; to: string }) {
  const [fromDate, fromTime] = item.from.split("T");
  const [toDate, toTime] = item.to.split("T");
  const isWholeDays = fromTime === "00:00" && toTime === "00:00";
  if (isWholeDays) {
    const lastDay = addDays(toDate, -1);
    return lastDay === fromDate ? formatDateLong(fromDate) : `${formatDateLong(fromDate)} – ${formatDateLong(lastDay)}`;
  }
  return fromDate === toDate
    ? `${formatDateLong(fromDate)}, ${fromTime}–${toTime}`
    : `${formatDateLong(fromDate)}, ${fromTime} – ${formatDateLong(toDate)}, ${toTime}`;
}

type Draft = { target: string; type: TimeOffType; note: string; fromDate: string; toDate: string; isPartial: boolean; fromTime: string; toTime: string };

function toDraft(item: AdminTimeOff | null, today: string): Draft {
  if (!item) {
    return { target: SALON, type: "day_off", note: "", fromDate: today, toDate: today, isPartial: false, fromTime: "10:00", toTime: "14:00" };
  }
  const [fromDate, fromTime] = item.from.split("T");
  const [toDate, toTime] = item.to.split("T");
  const isPartial = !(fromTime === "00:00" && toTime === "00:00");
  return {
    target: item.barberId ?? SALON,
    type: item.type,
    note: item.note ?? "",
    fromDate,
    toDate: isPartial ? toDate : addDays(toDate, -1),
    isPartial,
    fromTime: isPartial ? fromTime : "10:00",
    toTime: isPartial ? toTime : "14:00",
  };
}

function toInput(draft: Draft): AdminTimeOffInput {
  return {
    barberId: draft.target === SALON ? null : draft.target,
    type: draft.type,
    note: draft.note.trim() || null,
    from: `${draft.fromDate}T${draft.isPartial ? draft.fromTime : "00:00"}`,
    to: draft.isPartial ? `${draft.fromDate}T${draft.toTime}` : `${addDays(draft.toDate, 1)}T00:00`,
  };
}

function TimeOffDialog({
  item,
  barbers,
  onClose,
  onSaved,
}: {
  item: AdminTimeOff | "new" | null;
  barbers: AdminBarber[];
  onClose: () => void;
  onSaved: (saved: AdminTimeOff) => void;
}) {
  const today = getTashkentToday();
  const [draft, setDraft] = useState(() => toDraft(item === "new" ? null : item, today));
  const [shown, setShown] = useState(item);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (item !== shown) {
    setShown(item);
    setDraft(toDraft(item === "new" ? null : item, today));
    setError(null);
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const input = toInput(draft);
  const isValid = input.from < input.to;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const saved = item === "new" || !item ? await adminApi.createTimeOff(input) : await adminApi.updateTimeOff(item.id, input);
      onSaved(saved);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={item !== null} onClose={onClose} title={item === "new" ? "Новое исключение" : "Исключение"}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Для кого">
            {(id) => (
              <select id={id} className={inputClass} value={draft.target} onChange={(event) => set("target", event.target.value)}>
                <option value={SALON}>Весь салон</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Причина">
            {(id) => (
              <select id={id} className={inputClass} value={draft.type} onChange={(event) => set("type", event.target.value as TimeOffType)}>
                {(Object.keys(typeLabels) as TimeOffType[]).map((type) => (
                  <option key={type} value={type}>
                    {typeLabels[type]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div className="flex gap-1" role="radiogroup" aria-label="Длительность">
          {[
            { value: false, label: "Целые дни" },
            { value: true, label: "Часть дня" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={draft.isPartial === option.value}
              onClick={() => set("isPartial", option.value)}
              className={`h-9 border px-4 text-sm transition-colors ${
                draft.isPartial === option.value ? "border-bone bg-bone text-graphite" : "border-bone/15 text-ash hover:text-bone"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {draft.isPartial ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="День">
              {(id) => <input id={id} type="date" className={inputClass} value={draft.fromDate} onChange={(event) => set("fromDate", event.target.value)} />}
            </Field>
            <Field label="С">
              {(id) => <input id={id} type="time" step={300} className={inputClass} value={draft.fromTime} onChange={(event) => set("fromTime", event.target.value)} />}
            </Field>
            <Field label="До">
              {(id) => <input id={id} type="time" step={300} className={inputClass} value={draft.toTime} onChange={(event) => set("toTime", event.target.value)} />}
            </Field>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Первый день">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  className={inputClass}
                  value={draft.fromDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => ({ ...current, fromDate: value, toDate: current.toDate < value ? value : current.toDate }));
                  }}
                />
              )}
            </Field>
            <Field label="Последний день">
              {(id) => (
                <input id={id} type="date" min={draft.fromDate} className={inputClass} value={draft.toDate} onChange={(event) => set("toDate", event.target.value)} />
              )}
            </Field>
          </div>
        )}

        <Field label="Комментарий" hint="Видно только в админке">
          {(id) => <input id={id} className={inputClass} value={draft.note} onChange={(event) => set("note", event.target.value)} />}
        </Field>

        {!isValid && <Notice>Конец должен быть позже начала.</Notice>}
        {error && <Notice>{error}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={isBusy || !isValid || !draft.fromDate || !draft.toDate}>
            {isBusy ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function AdminTimeOffPage() {
  const items = useRemote("time-off", adminApi.timeOff);
  const barbers = useRemote("barbers", adminApi.barbers);
  const [editing, setEditing] = useState<AdminTimeOff | "new" | null>(null);
  const [warning, setWarning] = useState<AdminTimeOff | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setError(null);
    try {
      await adminApi.deleteTimeOff(id);
      items.reload();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <>
      <PageHeader
        title="Исключения"
        description="Разовые выходные, отпуска, больничные и праздники. В эти интервалы запись закрыта."
        actions={
          <Button variant="primary" disabled={!barbers.data} onClick={() => setEditing("new")}>
            Добавить
          </Button>
        }
      />

      {warning && warning.conflicts > 0 && (
        <div className="mb-6">
          <Notice>
            На этот интервал уже есть {pluralize(warning.conflicts, ["запись", "записи", "записей"])}. Перенесите
            или отмените их в разделе{" "}
            <Link href="/admin/bookings" className="underline underline-offset-4">
              «Записи»
            </Link>
            .
          </Notice>
        </div>
      )}
      {error && (
        <div className="mb-6">
          <Notice>{error}</Notice>
        </div>
      )}

      {items.status !== "ready" ? (
        <LoadState status={items.status === "error" ? "error" : "loading"} onRetry={items.reload} />
      ) : items.data.length === 0 ? (
        <Empty>Предстоящих исключений нет.</Empty>
      ) : (
        <ul className="divide-y divide-bone/10 border-y border-bone/10">
          {items.data.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-2 py-4">
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-sm font-medium">{formatRange(item)}</p>
                <p className="mt-1 text-xs text-ash">
                  {typeLabels[item.type]}, {item.barberName ?? "весь салон"}
                  {item.note ? `. ${item.note}` : ""}
                </p>
              </div>
              {item.conflicts > 0 && (
                <span className="text-xs text-red-300">
                  {pluralize(item.conflicts, ["запись", "записи", "записей"])} в интервале
                </span>
              )}
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                  Изменить
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                  Удалить
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {barbers.data && (
        <TimeOffDialog
          item={editing}
          barbers={barbers.data}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setWarning(saved);
            items.reload();
          }}
        />
      )}
    </>
  );
}
