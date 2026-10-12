"use client";

import { useState, type FormEvent } from "react";
import type { AdminService, AdminServiceInput } from "@barbershop/shared";
import { formatDuration, formatPrice } from "@barbershop/shared/format";
import { Button, Checkbox, Dialog, Empty, Field, LoadState, Notice, PageHeader, inputClass } from "@/components/admin/ui";
import { adminApi, errorMessage } from "@/lib/admin-api";
import { useRemote } from "@/lib/use-remote";

const categoryLabels = { hair: "Стрижки", beard: "Борода и бритьё" } as const;

const emptyService: AdminServiceInput = { name: "", description: "", category: "hair", durationMin: 60, price: 0, isActive: true };

function ServiceDialog({
  service,
  onClose,
  onSaved,
}: {
  service: AdminService | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = service && service !== "new" ? service : emptyService;
  const [form, setForm] = useState<AdminServiceInput>(initial);
  const [shown, setShown] = useState(service);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (service !== shown) {
    setShown(service);
    setForm(initial);
    setError(null);
  }

  const set = <K extends keyof AdminServiceInput>(key: K, value: AdminServiceInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const input: AdminServiceInput = {
        name: form.name,
        description: form.description,
        category: form.category,
        durationMin: form.durationMin,
        price: form.price,
        isActive: form.isActive,
      };
      if (service === "new") await adminApi.createService(input);
      else if (service) await adminApi.updateService(service.id, input);
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={service !== null} onClose={onClose} title={service === "new" ? "Новая услуга" : "Услуга"}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Название">
          {(id) => <input id={id} className={inputClass} value={form.name} onChange={(event) => set("name", event.target.value)} />}
        </Field>
        <Field label="Описание" hint="Видно клиентам на сайте и в Mini App">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              className={`${inputClass} h-auto py-2.5`}
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Категория">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={form.category}
                onChange={(event) => set("category", event.target.value as AdminServiceInput["category"])}
              >
                <option value="hair">{categoryLabels.hair}</option>
                <option value="beard">{categoryLabels.beard}</option>
              </select>
            )}
          </Field>
          <Field label="Длительность, мин">
            {(id) => (
              <input
                id={id}
                type="number"
                min={5}
                step={5}
                className={`${inputClass} tabular-nums`}
                value={form.durationMin}
                onChange={(event) => set("durationMin", Number(event.target.value))}
              />
            )}
          </Field>
          <Field label="Цена, сум">
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                step={1000}
                className={`${inputClass} tabular-nums`}
                value={form.price}
                onChange={(event) => set("price", Number(event.target.value))}
              />
            )}
          </Field>
        </div>
        <Checkbox checked={form.isActive ?? true} onChange={(value) => set("isActive", value)} label="Доступна для записи" />
        {error && <Notice>{error}</Notice>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={isBusy || form.name.trim().length < 2}>
            {isBusy ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function AdminServicesPage() {
  const services = useRemote("services", adminApi.services);
  const [editing, setEditing] = useState<AdminService | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminService | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!deleting) return;
    setError(null);
    try {
      await adminApi.deleteService(deleting.id);
      setDeleting(null);
      services.reload();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <>
      <PageHeader
        title="Услуги"
        description="Базовые цены и длительность. Для отдельного мастера их можно переопределить в его карточке."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            Добавить услугу
          </Button>
        }
      />

      {services.status !== "ready" ? (
        <LoadState status={services.status === "error" ? "error" : "loading"} onRetry={services.reload} />
      ) : services.data.length === 0 ? (
        <Empty>Услуг пока нет.</Empty>
      ) : (
        <div className="space-y-10">
          {(["hair", "beard"] as const).map((category) => {
            const items = services.data.filter((service) => service.category === category);
            if (items.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="mb-3 text-sm text-ash">{categoryLabels[category]}</h2>
                <ul className="divide-y divide-bone/10 border-y border-bone/10">
                  {items.map((service) => (
                    <li key={service.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-2 py-4">
                      <div className="min-w-0 flex-1 basis-60">
                        <p className={`text-sm font-medium ${service.isActive ? "" : "text-ash"}`}>
                          {service.name}
                          {!service.isActive && <span className="ml-2 text-xs font-normal">скрыта</span>}
                        </p>
                        {service.description && <p className="mt-1 line-clamp-1 text-xs text-ash">{service.description}</p>}
                      </div>
                      <span className="w-20 text-sm text-ash tabular-nums">{formatDuration(service.durationMin)}</span>
                      <span className="w-28 text-right text-sm tabular-nums">{formatPrice(service.price)}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(service)}>
                          Изменить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setError(null);
                            setDeleting(service);
                          }}
                        >
                          Удалить
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <ServiceDialog
        service={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          services.reload();
        }}
      />
      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Удалить услугу?">
        <p className="text-sm text-ash">
          «{deleting?.name}» пропадёт из записи. Если на неё есть будущие записи, удалить не получится: скройте услугу.
        </p>
        {error && (
          <div className="mt-5">
            <Notice>{error}</Notice>
          </div>
        )}
        <div className="mt-8 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Отмена
          </Button>
          <Button variant="danger" onClick={remove}>
            Удалить
          </Button>
        </div>
      </Dialog>
    </>
  );
}
