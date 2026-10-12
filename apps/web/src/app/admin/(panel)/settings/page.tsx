"use client";

import { useState, type FormEvent } from "react";
import type { AdminSettings, AdminSettingsInput } from "@barbershop/shared";
import { Button, Field, LoadState, Notice, PageHeader, inputClass } from "@/components/admin/ui";
import { adminApi, errorMessage } from "@/lib/admin-api";
import { useRemote } from "@/lib/use-remote";

type NumberKey = Exclude<keyof AdminSettingsInput, "slotStepMin">;

const groups: { title: string; fields: { key: NumberKey; label: string; hint: string; unit: "min" | "hours" | "days" | "stars" }[] }[] = [
  {
    title: "Запись",
    fields: [
      { key: "bookingHorizonDays", label: "Горизонт записи, дней", hint: "На сколько дней вперёд клиент видит свободное время", unit: "days" },
      { key: "minNoticeMin", label: "Минимум до визита, мин", hint: "Ближайший слот, доступный клиенту. Админку не ограничивает", unit: "min" },
      { key: "cancelCutoffMin", label: "Отмена клиентом, мин", hint: "За сколько минут до визита клиент ещё может отменить или перенести", unit: "min" },
    ],
  },
  {
    title: "Напоминания и отзывы",
    fields: [
      { key: "reminderDayMin", label: "Первое напоминание, ч", hint: "За сколько часов до визита", unit: "hours" },
      { key: "reminderShortMin", label: "Второе напоминание, мин", hint: "Короткое напоминание перед визитом", unit: "min" },
      { key: "reviewDelayMin", label: "Просьба об отзыве, мин", hint: "Через сколько минут после визита бот просит оценку", unit: "min" },
      { key: "reviewPublicMinRating", label: "Публиковать от, звёзд", hint: "Отзывы с такой оценкой и выше сразу попадают на сайт", unit: "stars" },
    ],
  },
];

/** В форме часы показываются как часы, в API уходят минуты. */
const toForm = (key: NumberKey, value: number) => (key === "reminderDayMin" ? value / 60 : value);
const fromForm = (key: NumberKey, value: number) => (key === "reminderDayMin" ? Math.round(value * 60) : value);

function SettingsForm({ settings, onSaved }: { settings: AdminSettings; onSaved: (settings: AdminSettings) => void }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(groups.flatMap((group) => group.fields.map(({ key }) => [key, String(toForm(key, settings[key]))]))) as Record<NumberKey, string>,
  );
  const [slotStep, setSlotStep] = useState(settings.slotStepMin);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setStatus(null);
    const numbers = Object.fromEntries(
      (Object.keys(values) as NumberKey[]).map((key) => [key, fromForm(key, Number(values[key]))]),
    ) as Record<NumberKey, number>;
    try {
      const saved = await adminApi.updateSettings({ ...numbers, slotStepMin: slotStep });
      onSaved(saved);
      setStatus({ tone: "success", text: "Настройки сохранены" });
    } catch (failure) {
      setStatus({ tone: "error", text: errorMessage(failure) });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-3xl">
      <section className="pb-8">
        <h2 className="mb-6 font-display text-base font-medium">Сетка времени</h2>
        <Field label="Шаг слотов" hint="С каким интервалом клиенту предлагается время" className="max-w-xs">
          {(id) => (
            <select
              id={id}
              className={inputClass}
              value={slotStep}
              onChange={(event) => setSlotStep(Number(event.target.value) as AdminSettingsInput["slotStepMin"])}
            >
              {[5, 10, 15, 20, 30, 60].map((step) => (
                <option key={step} value={step}>
                  {step} мин
                </option>
              ))}
            </select>
          )}
        </Field>
      </section>
      {groups.map((group) => (
        <section key={group.title} className="border-t border-bone/10 py-8">
          <h2 className="mb-6 font-display text-base font-medium">{group.title}</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {group.fields.map((field) => (
              <Field key={field.key} label={field.label} hint={field.hint}>
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    min={field.unit === "stars" ? 1 : 0}
                    max={field.unit === "stars" ? 5 : undefined}
                    step={field.unit === "hours" ? 0.5 : 1}
                    className={`${inputClass} tabular-nums`}
                    value={values[field.key]}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                )}
              </Field>
            ))}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-4 border-t border-bone/10 pt-8">
        <Button type="submit" variant="primary" disabled={isBusy}>
          {isBusy ? "Сохраняем…" : "Сохранить"}
        </Button>
        {status && <Notice tone={status.tone}>{status.text}</Notice>}
      </div>
    </form>
  );
}

export default function AdminSettingsPage() {
  const settings = useRemote("settings", adminApi.settings);
  const [saved, setSaved] = useState<AdminSettings | null>(null);
  const current = saved ?? settings.data;

  return (
    <>
      <PageHeader title="Настройки" description={current ? `Часовой пояс салона: ${current.timezone}` : undefined} />
      {current ? (
        <SettingsForm settings={current} onSaved={setSaved} />
      ) : (
        <LoadState status={settings.status === "error" ? "error" : "loading"} onRetry={settings.reload} />
      )}
    </>
  );
}
