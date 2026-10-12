import type { Barber } from "@barbershop/shared";
import Image from "next/image";
import { ANY_BARBER } from "@/lib/booking";
import { formatYears, getInitials } from "@/lib/format";

type StepBarberProps = {
  barbers: Barber[];
  selected: string | null;
  onSelect: (id: string) => void;
};

const cardClass = (isActive: boolean) =>
  `group relative flex h-full flex-col border text-left transition-colors duration-300 ${
    isActive ? "border-tungsten" : "border-bone/15 hover:border-bone/40"
  }`;

export function StepBarber({ barbers, selected, onSelect }: StepBarberProps) {
  return (
    <div role="radiogroup" aria-label="Мастер" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
      <button
        type="button"
        role="radio"
        aria-checked={selected === ANY_BARBER}
        onClick={() => onSelect(ANY_BARBER)}
        className={`${cardClass(selected === ANY_BARBER)} col-span-2 justify-between p-5 md:col-span-1`}
      >
        <span className="font-display text-xl leading-tight font-light tracking-[-0.02em]">
          Любой свободный
        </span>
        <span className="mt-6 text-sm text-ash">
          Покажем все свободные окна и назначим мастера, который свободен в это время.
        </span>
      </button>

      {barbers.map((barber) => {
        const isActive = selected === barber.id;
        return (
          <button
            key={barber.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(barber.id)}
            className={cardClass(isActive)}
          >
            <span className="relative block aspect-[4/3] overflow-hidden bg-graphite-3">
              {barber.photoUrl ? (
                <Image
                  src={barber.photoUrl}
                  alt=""
                  fill
                  loading="eager"
                  sizes="(min-width: 768px) 20vw, 45vw"
                  className={`photo-mono object-cover object-top transition-opacity duration-300 ${
                    isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                  }`}
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center font-display text-3xl font-light text-bone/20">
                  {getInitials(barber.name)}
                </span>
              )}
            </span>
            <span className="flex flex-1 flex-col p-4">
              <span className="flex items-start justify-between gap-2">
                <span className="font-display text-base leading-tight font-light tracking-[-0.02em]">
                  {barber.name}
                </span>
                {barber.rating !== null && (
                  <span className="text-sm text-tungsten tabular-nums">{barber.rating.toFixed(1)}</span>
                )}
              </span>
              <span className="mt-2 text-xs text-ash">
                {barber.specialties.join(", ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}.
                Опыт {formatYears(barber.experienceYears)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
