"use client";

import Image from "next/image";
import Link from "next/link";
import type { Barber } from "@barbershop/shared";
import { useRef } from "react";
import { formatYears, getInitials, pluralize } from "@/lib/format";
import { DESKTOP_MOTION, gsap, useGSAP } from "@/lib/gsap";

const intro =
  "У каждого своя специализация. Выберите мастера под задачу или доверьтесь тому, кто свободен раньше.";

const numerals = ["", "Один", "Два", "Три", "Четыре", "Пять", "Шесть", "Семь", "Восемь", "Девять"];

function getTitle(count: number): string {
  const word = numerals[count];
  if (!word) return "Наши мастера";
  const masters = pluralize(count, ["мастер", "мастера", "мастеров"]).split(" ")[1];
  const hands = pluralize(count, ["почерк", "почерка", "почерков"]).split(" ")[1];
  return `${word} ${masters}, ${word.toLowerCase()} ${hands}`;
}

export function MastersGallery({ barbers }: { barbers: Barber[] }) {
  const root = useRef<HTMLElement>(null);
  const title = getTitle(barbers.length);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(DESKTOP_MOTION, () => {
        const node = track.current;
        if (!node) return;

        gsap.set(node, { overflow: "visible" });
        const distance = () => node.scrollWidth - window.innerWidth;

        gsap.to(node, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="masters"
      aria-label="Мастера"
      className="overflow-hidden border-t border-bone/10 py-24 lg:flex lg:h-[100dvh] lg:items-center lg:py-0"
    >
      <div className="container-page mb-12 lg:hidden">
        <h2 className="text-display text-[clamp(2.5rem,9vw,4rem)] font-light">{title}</h2>
        <p className="mt-6 max-w-[40ch] text-ash">{intro}</p>
      </div>

      <div
        ref={track}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 [scrollbar-width:none] sm:px-8 lg:w-full lg:snap-none lg:gap-[4vw] lg:px-12 lg:pb-0"
      >
        <div className="hidden shrink-0 flex-col justify-end lg:flex lg:w-[34vw]">
          <h2 className="text-display text-[clamp(3rem,5.4vw,6rem)] font-light">{title}</h2>
          <p className="mt-8 max-w-[36ch] text-ash">{intro}</p>
        </div>

        {barbers.map((barber, index) => (
          <article
            key={barber.id}
            className="group w-[78vw] shrink-0 snap-start sm:w-[46vw] lg:w-[min(25vw,calc((100dvh-18rem)*0.75))]"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-graphite-3">
              {barber.photoUrl ? (
                <Image
                  src={barber.photoUrl}
                  alt={`Мастер ${barber.name}`}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 46vw, 78vw"
                  className="photo-mono object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-[1.04]"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center font-display text-6xl font-light text-bone/20">
                  {getInitials(barber.name)}
                </span>
              )}
              <span className="absolute top-4 left-4 font-display text-xs text-bone/70 tabular-nums">
                0{index + 1}
              </span>
            </div>

            <div className="mt-6 flex items-start justify-between gap-4 border-t border-bone/15 pt-5">
              <div>
                <h3 className="font-display text-xl font-light tracking-[-0.02em]">{barber.name}</h3>
                <p className="mt-2 text-sm text-ash">
                  {barber.specialties.join(", ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}.
                  Опыт {formatYears(barber.experienceYears)}
                </p>
              </div>
              {barber.rating !== null && (
                <span className="font-display text-sm text-tungsten tabular-nums">
                  {barber.rating.toFixed(1)}
                </span>
              )}
            </div>

            <Link
              href={`/book?barber=${barber.id}`}
              className="mt-5 inline-flex items-center gap-3 text-sm text-bone transition-colors duration-300 hover:text-tungsten"
            >
              <span className="h-px w-8 bg-current transition-[width] duration-500 group-hover:w-12" />
              Записаться
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
