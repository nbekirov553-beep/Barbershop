"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import type { AdminBarber, AdminBarberServices, AdminService } from "@barbershop/shared";
import { formatDuration, formatPrice } from "@barbershop/shared/format";
import { Button, Checkbox, Dialog, Field, LoadState, Notice, inputClass } from "@/components/admin/ui";
import { adminApi, errorMessage } from "@/lib/admin-api";
import { TIMEZONE } from "@/lib/booking";
import { getInitials } from "@/lib/format";
import { useRemote } from "@/lib/use-remote";

const ACCEPT = "image/jpeg,image/png,image/webp";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-bone/10 py-10 lg:grid-cols-[16rem_1fr] lg:gap-12">
      <div>
        <h2 className="font-display text-base font-medium">{title}</h2>
        {description && <p className="mt-2 text-sm text-ash">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function UploadButton({
  folder,
  onUploaded,
  children,
}: {
  folder: "barbers" | "portfolio";
  onUploaded: (url: string) => Promise<void> | void;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setIsBusy(true);
    setError(null);
    try {
      const { url } = await adminApi.upload(file, folder);
      await onUploaded(url);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setIsBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <Button size="sm" disabled={isBusy} onClick={() => input.current?.click()}>
        {isBusy ? "Загружаем…" : children}
      </Button>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function ProfileSection({ barber, onSaved }: { barber: AdminBarber; onSaved: (barber: AdminBarber) => void }) {
  const [name, setName] = useState(barber.name);
  const [bio, setBio] = useState(barber.bio);
  const [experience, setExperience] = useState(barber.experienceYears);
  const [specialties, setSpecialties] = useState(barber.specialties.join(", "));
  const [isActive, setIsActive] = useState(barber.isActive);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setStatus(null);
    try {
      const updated = await adminApi.updateBarber(barber.id, {
        name,
        bio,
        experienceYears: experience,
        specialties: specialties
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        isActive,
      });
      onSaved(updated);
      setStatus({ tone: "success", text: "Сохранено" });
    } catch (failure) {
      setStatus({ tone: "error", text: errorMessage(failure) });
    } finally {
      setIsBusy(false);
    }
  };

  const setPhoto = async (photoUrl: string | null) => onSaved(await adminApi.updateBarber(barber.id, { photoUrl }));

  return (
    <Section title="Профиль" description="Так мастер выглядит на сайте и в Mini App.">
      <div className="mb-8 flex items-end gap-5">
        <div className="relative aspect-[4/5] w-32 shrink-0 overflow-hidden bg-graphite-3">
          {barber.photoUrl ? (
            <Image src={barber.photoUrl} alt={barber.name} fill sizes="128px" className="object-cover" />
          ) : (
            <span className="grid size-full place-items-center font-display text-2xl text-ash">{getInitials(barber.name)}</span>
          )}
        </div>
        <div className="space-y-2">
          <UploadButton folder="barbers" onUploaded={setPhoto}>
            {barber.photoUrl ? "Заменить фото" : "Загрузить фото"}
          </UploadButton>
          {barber.photoUrl && (
            <Button size="sm" variant="ghost" onClick={() => setPhoto(null)}>
              Убрать фото
            </Button>
          )}
          <p className="text-xs text-ash">JPG, PNG или WebP до 4 МБ, вертикальное 4:5</p>
        </div>
      </div>

      <form onSubmit={save} className="max-w-2xl space-y-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
          <Field label="Имя">
            {(id) => <input id={id} className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />}
          </Field>
          <Field label="Стаж, лет">
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                max={60}
                className={`${inputClass} tabular-nums`}
                value={experience}
                onChange={(event) => setExperience(Number(event.target.value))}
              />
            )}
          </Field>
        </div>
        <Field label="О мастере">
          {(id) => (
            <textarea
              id={id}
              rows={4}
              className={`${inputClass} h-auto py-2.5`}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          )}
        </Field>
        <Field label="Специализация" hint="Через запятую: фейд, классика, борода">
          {(id) => (
            <input id={id} className={inputClass} value={specialties} onChange={(event) => setSpecialties(event.target.value)} />
          )}
        </Field>
        <Checkbox checked={isActive} onChange={setIsActive} label="Принимает записи и виден на сайте" />
        {status && <Notice tone={status.tone}>{status.text}</Notice>}
        <Button type="submit" variant="primary" disabled={isBusy || name.trim().length < 2}>
          {isBusy ? "Сохраняем…" : "Сохранить профиль"}
        </Button>
      </form>
    </Section>
  );
}

type Override = { isEnabled: boolean; price: string; durationMin: string };

function ServicesSection({
  barber,
  services,
  onSaved,
}: {
  barber: AdminBarber;
  services: AdminService[];
  onSaved: (barber: AdminBarber) => void;
}) {
  const initial = () =>
    Object.fromEntries(
      services.map((service) => {
        const link = barber.services.find((item) => item.serviceId === service.id);
        return [
          service.id,
          {
            isEnabled: link?.isEnabled ?? false,
            price: link?.price?.toString() ?? "",
            durationMin: link?.durationMin?.toString() ?? "",
          },
        ];
      }),
    ) as Record<string, Override>;
  const [rows, setRows] = useState(initial);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const update = (id: string, patch: Partial<Override>) => setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const save = async () => {
    setIsBusy(true);
    setStatus(null);
    const items: AdminBarberServices = services.map((service) => ({
      serviceId: service.id,
      isEnabled: rows[service.id].isEnabled,
      price: rows[service.id].price === "" ? null : Number(rows[service.id].price),
      durationMin: rows[service.id].durationMin === "" ? null : Number(rows[service.id].durationMin),
    }));
    try {
      onSaved(await adminApi.updateBarberServices(barber.id, items));
      setStatus({ tone: "success", text: "Сохранено" });
    } catch (failure) {
      setStatus({ tone: "error", text: errorMessage(failure) });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Section title="Услуги и цены" description="Пустое поле означает базовую цену или длительность из раздела «Услуги».">
      <ul className="divide-y divide-bone/10 border-y border-bone/10">
        {services.map((service) => {
          const row = rows[service.id];
          return (
            <li key={service.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_9rem_7rem] sm:items-center">
              <Checkbox
                checked={row.isEnabled}
                onChange={(value) => update(service.id, { isEnabled: value })}
                label={
                  <span>
                    {service.name}
                    {!service.isActive && <span className="ml-2 text-xs text-ash">скрыта</span>}
                  </span>
                }
              />
              <input
                type="number"
                min={0}
                step={1000}
                aria-label={`Цена: ${service.name}`}
                placeholder={formatPrice(service.price)}
                disabled={!row.isEnabled}
                className={`${inputClass} h-9 tabular-nums`}
                value={row.price}
                onChange={(event) => update(service.id, { price: event.target.value })}
              />
              <input
                type="number"
                min={5}
                step={5}
                aria-label={`Длительность в минутах: ${service.name}`}
                placeholder={formatDuration(service.durationMin)}
                disabled={!row.isEnabled}
                className={`${inputClass} h-9 tabular-nums`}
                value={row.durationMin}
                onChange={(event) => update(service.id, { durationMin: event.target.value })}
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button variant="primary" disabled={isBusy} onClick={save}>
          {isBusy ? "Сохраняем…" : "Сохранить услуги"}
        </Button>
        {status && <Notice tone={status.tone}>{status.text}</Notice>}
      </div>
    </Section>
  );
}

function PortfolioSection({ barber, onChanged }: { barber: AdminBarber; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setError(null);
    try {
      await adminApi.deletePortfolio(id);
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <Section title="Портфолио" description="Работы мастера в карточке на сайте.">
      {barber.portfolio.length > 0 && (
        <ul className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {barber.portfolio.map((item) => (
            <li key={item.id} className="group relative aspect-square overflow-hidden bg-graphite-3">
              <Image src={item.imageUrl} alt="" fill sizes="(min-width: 1280px) 200px, 45vw" className="object-cover" />
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="absolute inset-x-0 bottom-0 h-9 bg-graphite/85 text-xs text-bone opacity-100 transition-opacity hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
      <UploadButton
        folder="portfolio"
        onUploaded={async (url) => {
          await adminApi.addPortfolio(barber.id, url);
          onChanged();
        }}
      >
        Добавить работу
      </UploadButton>
      {error && (
        <div className="mt-4">
          <Notice>{error}</Notice>
        </div>
      )}
    </Section>
  );
}

function TelegramSection({ barber }: { barber: AdminBarber }) {
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setError(null);
    setCopied(false);
    try {
      setLink(await adminApi.telegramLink(barber.id));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <Section title="Telegram" description="Мастер получает в боте уведомления о новых записях, переносах и отменах.">
      <p className="mb-4 text-sm">{barber.telegramLinked ? "Аккаунт привязан." : "Аккаунт не привязан."}</p>
      <Button size="sm" onClick={generate}>
        {barber.telegramLinked ? "Перепривязать" : "Получить ссылку для привязки"}
      </Button>
      {link && (
        <div className="mt-5 max-w-xl space-y-3">
          <input readOnly value={link.url} aria-label="Ссылка для привязки" className={`${inputClass} text-xs`} onFocus={(event) => event.target.select()} />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(link.url);
                setCopied(true);
              }}
            >
              {copied ? "Скопировано" : "Скопировать"}
            </Button>
            <p className="text-xs text-ash">
              Отправьте мастеру. Ссылка одноразовая, действует до{" "}
              {new Date(link.expiresAt).toLocaleString("ru-RU", {
                timeZone: TIMEZONE,
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </p>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <Notice>{error}</Notice>
        </div>
      )}
    </Section>
  );
}

export default function AdminBarberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const remote = useRemote(`barber:${id}`, () => adminApi.barber(id));
  const services = useRemote("services", adminApi.services);
  const [local, setLocal] = useState<AdminBarber | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const barber = local?.id === id && local ? local : remote.data;

  if (!barber || !services.data) {
    return (
      <LoadState
        status={remote.status === "error" || services.status === "error" ? "error" : "loading"}
        onRetry={() => {
          remote.reload();
          services.reload();
        }}
      />
    );
  }

  const remove = async () => {
    setDeleteError(null);
    try {
      await adminApi.deleteBarber(barber.id);
      router.replace("/admin/barbers");
    } catch (failure) {
      setDeleteError(errorMessage(failure));
    }
  };

  const refresh = () => {
    setLocal(null);
    remote.reload();
  };

  return (
    <>
      <div className="mb-8">
        <Link href="/admin/barbers" className="text-sm text-ash hover:text-bone">
          Все мастера
        </Link>
        <h1 className="mt-3 font-display text-2xl font-medium tracking-tight sm:text-3xl">{barber.name}</h1>
        <p className="mt-2 text-sm text-ash">
          {barber.workingHours.length ? (
            <Link href={`/admin/schedule?barber=${barber.id}`} className="underline underline-offset-4 hover:text-bone">
              Рабочие часы и обеды
            </Link>
          ) : (
            <Link href={`/admin/schedule?barber=${barber.id}`} className="text-tungsten underline underline-offset-4">
              Задайте график, иначе запись к мастеру недоступна
            </Link>
          )}
        </p>
      </div>

      <ProfileSection key={`profile:${barber.id}`} barber={barber} onSaved={setLocal} />
      <ServicesSection key={`services:${barber.id}:${services.data.length}`} barber={barber} services={services.data} onSaved={setLocal} />
      <PortfolioSection barber={barber} onChanged={refresh} />
      <TelegramSection barber={barber} />

      <Section title="Удаление" description="Мастера с записями удалить нельзя: снимите галочку «Принимает записи».">
        <Button variant="danger" size="sm" onClick={() => setIsDeleting(true)}>
          Удалить мастера
        </Button>
      </Section>

      <Dialog open={isDeleting} onClose={() => setIsDeleting(false)} title="Удалить мастера?">
        <p className="text-sm text-ash">{barber.name} пропадёт из админки, сайта и Mini App вместе с графиком и портфолио.</p>
        {deleteError && (
          <div className="mt-5">
            <Notice>{deleteError}</Notice>
          </div>
        )}
        <div className="mt-8 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsDeleting(false)}>
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
