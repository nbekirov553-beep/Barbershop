"use client";

import Image from "next/image";
import Link from "next/link";
import type { Barber, Service } from "@barbershop/shared";
import { useEffect, useState } from "react";
import { ANY_BARBER, getDayLabel } from "@/lib/booking";
import { fetchAvailability, fetchAvailabilityDays } from "@/lib/client-api";
import { pluralize } from "@/lib/format";

const PREVIEW_SLOTS = 8;
/** Окна смотрим только на ближайшую неделю, дальше — страница записи. */
const PREVIEW_DAYS = 7;

type PreviewState = { date: string | null; slots: string[]; total: number; failed: boolean };

async function loadNearest(service: Service, barberId: string): Promise<PreviewState> {
  const serviceIds = [service.id];
  const { days } = await fetchAvailabilityDays({ serviceIds, barberId });
  const nearest = days.slice(0, PREVIEW_DAYS).find((day) => day.available);
  if (!nearest) return { date: null, slots: [], total: 0, failed: false };

  const { slots } = await fetchAvailability({ serviceIds, barberId, date: nearest.date });
  return { date: nearest.date, slots: slots.slice(0, PREVIEW_SLOTS), total: slots.length, failed: false };
}

type BookingPreviewProps = { barbers: Barber[]; service: Service | undefined };

export function BookingPreview({ barbers, service }: BookingPreviewProps) {
  const [anyBarber, setAnyBarber] = useState(true);
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ date: null, slots: [], total: 0, failed: false });
  const [isLoading, setIsLoading] = useState(true);

  const activeBarberId = anyBarber ? ANY_BARBER : barberId;
  const { date, slots, total, failed } = preview;

  useEffect(() => {
    if (!service) return;
    let isActive = true;

    loadNearest(service, activeBarberId)
      .catch((): PreviewState => ({ date: null, slots: [], total: 0, failed: true }))
      .then((next) => {
        if (!isActive) return;
        setPreview(next);
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [service, activeBarberId]);

  const startLoading = () => {
    setSlot(null);
    setIsLoading(true);
  };

  const selectedBarber = barbers.find((barber) => barber.id === barberId);
  const bookHref =
    slot && date
      ? `/book?date=${date}&time=${slot}${service ? `&service=${service.id}` : ""}${anyBarber ? "" : `&barber=${barberId}`}`
      : "/book";

  return (
    <div className="border border-bone/15 bg-graphite/60">
      <div className="flex items-center justify-between gap-4 border-b border-bone/15 px-5 py-4 sm:px-6">
        <p className="text-sm text-ash">
          {date ? getDayLabel(date) : "Ближайшие окна"}
          {service && <span className="text-ash/60">, {service.name.toLowerCase()}</span>}
        </p>
        <p className="shrink-0 text-sm text-ash" aria-live="polite">
          {isLoading ? "Обновляем" : pluralize(total, ["окно", "окна", "окон"])}
        </p>
      </div>

      <div className="border-b border-bone/15 px-5 py-5 sm:px-6">
        <button
          type="button"
          role="switch"
          aria-checked={anyBarber}
          onClick={() => {
            setAnyBarber((value) => !value);
            startLoading();
          }}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <span className="text-bone">Любой свободный мастер</span>
          <span
            aria-hidden="true"
            className={`relative h-5 w-10 border transition-colors duration-300 ${
              anyBarber ? "border-tungsten bg-tungsten/15" : "border-bone/30"
            }`}
          >
            <span
              className={`absolute top-[3px] h-3 w-3 transition-all duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] ${
                anyBarber ? "left-[23px] bg-tungsten" : "left-[3px] bg-ash"
              }`}
            />
          </span>
        </button>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${
            anyBarber ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
          }`}
          inert={anyBarber}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-4 gap-3 pt-5" role="radiogroup" aria-label="Мастер">
              {barbers.map((barber) => {
                const isActive = barber.id === barberId;
                return (
                  <button
                    key={barber.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => {
                      if (isActive) return;
                      setBarberId(barber.id);
                      startLoading();
                    }}
                    className="group text-left"
                  >
                    <span
                      className={`relative block aspect-square overflow-hidden border transition-colors duration-300 ${
                        isActive ? "border-tungsten" : "border-transparent group-hover:border-bone/30"
                      }`}
                    >
                      {barber.photoUrl && (
                        <Image
                          src={barber.photoUrl}
                          alt=""
                          fill
                          sizes="80px"
                          className={`photo-mono object-cover transition-opacity duration-300 ${
                            isActive ? "opacity-100" : "opacity-50 group-hover:opacity-80"
                          }`}
                        />
                      )}
                    </span>
                    <span
                      className={`mt-2 block truncate text-xs ${isActive ? "text-bone" : "text-ash"}`}
                    >
                      {barber.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[9.5rem] px-5 py-5 sm:px-6">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-px bg-bone/10 sm:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} className="h-12 animate-pulse bg-graphite-2" />
            ))}
          </div>
        ) : failed ? (
          <div className="flex h-full min-h-[6.5rem] flex-col justify-center">
            <p className="text-bone">Не удалось загрузить расписание</p>
            <p className="mt-2 text-sm text-ash">
              Откройте страницу записи или позвоните нам, и мы подберём время.
            </p>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex h-full min-h-[6.5rem] flex-col justify-center">
            <p className="text-bone">
              {anyBarber
                ? "На этой неделе свободных окон нет"
                : `${selectedBarber?.name.split(" ")[0]} на этой неделе без свободных окон`}
            </p>
            <p className="mt-2 text-sm text-ash">
              {anyBarber
                ? "Позвоните нам, и мы постараемся найти время."
                : "Включите «Любой свободный мастер» или выберите другой день на странице записи."}
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-3 border-t border-l border-bone/10 sm:grid-cols-4"
            role="radiogroup"
            aria-label="Время"
          >
            {slots.map((time) => {
              const isActive = time === slot;
              return (
                <button
                  key={time}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setSlot(isActive ? null : time)}
                  className={`h-12 border-r border-b border-bone/10 text-sm tabular-nums transition-colors duration-200 ${
                    isActive
                      ? "bg-tungsten text-graphite"
                      : "bg-graphite-2 text-bone hover:bg-graphite-3"
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-bone/15 p-2">
        {slot ? (
          <Link
            href={bookHref}
            className="flex h-14 items-center justify-center bg-bone text-sm font-medium text-graphite transition-colors duration-300 hover:bg-tungsten active:scale-[0.99]"
          >
            Записаться на {slot}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="flex h-14 cursor-not-allowed items-center justify-center border border-bone/10 text-sm text-ash"
          >
            Выберите время
          </span>
        )}
      </div>
    </div>
  );
}
