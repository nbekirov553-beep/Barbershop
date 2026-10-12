"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Dialog, Empty, Field, LoadState, Notice, PageHeader, inputClass } from "@/components/admin/ui";
import { adminApi, errorMessage } from "@/lib/admin-api";
import { getInitials } from "@/lib/format";
import { useRemote } from "@/lib/use-remote";

const weekdayShort = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function AdminBarbersPage() {
  const router = useRouter();
  const barbers = useRemote("barbers", adminApi.barbers);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const barber = await adminApi.createBarber({ name });
      router.push(`/admin/barbers/${barber.id}`);
    } catch (failure) {
      setError(errorMessage(failure));
      setIsBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Барберы"
        description="Профиль, фото, услуги и цены мастера. Рабочие часы задаются в разделе «График»."
        actions={
          <Button variant="primary" onClick={() => setIsCreating(true)}>
            Добавить мастера
          </Button>
        }
      />

      {barbers.status !== "ready" ? (
        <LoadState status={barbers.status === "error" ? "error" : "loading"} onRetry={barbers.reload} />
      ) : barbers.data.length === 0 ? (
        <Empty>Мастеров пока нет.</Empty>
      ) : (
        <ul className="grid gap-px border border-bone/10 bg-bone/10 sm:grid-cols-2 xl:grid-cols-3">
          {barbers.data.map((barber) => {
            const days = [1, 2, 3, 4, 5, 6, 0].filter((day) => barber.workingHours.some((item) => item.weekday === day));
            const enabled = barber.services.filter((item) => item.isEnabled).length;
            return (
              <li key={barber.id} className="bg-graphite">
                <Link href={`/admin/barbers/${barber.id}`} className="flex gap-4 p-5 transition-colors hover:bg-graphite-2">
                  <div className="relative size-20 shrink-0 overflow-hidden bg-graphite-3">
                    {barber.photoUrl ? (
                      <Image src={barber.photoUrl} alt="" fill sizes="80px" className="object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center font-display text-lg text-ash">
                        {getInitials(barber.name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate font-medium ${barber.isActive ? "" : "text-ash"}`}>{barber.name}</p>
                    <p className="mt-1 text-xs text-ash">
                      {barber.isActive ? "Принимает записи" : "Скрыт с сайта"}
                      {barber.telegramLinked ? ", Telegram привязан" : ""}
                    </p>
                    <p className="mt-3 text-xs text-ash">
                      {days.length ? days.map((day) => weekdayShort[day]).join(" ") : "График не задан"}
                    </p>
                    <p className="mt-1 text-xs text-ash">Услуг: {enabled}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={isCreating} onClose={() => setIsCreating(false)} title="Новый мастер">
        <form onSubmit={create} className="space-y-5">
          <Field label="Имя" hint="Остальное заполните в карточке мастера">
            {(id) => <input id={id} className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />}
          </Field>
          {error && <Notice>{error}</Notice>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsCreating(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={isBusy || name.trim().length < 2}>
              Создать
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
