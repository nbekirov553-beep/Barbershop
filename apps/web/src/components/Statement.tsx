"use client";

import type { Barber, Review } from "@barbershop/shared";
import { useRef } from "react";
import { ANY_MOTION, gsap, useGSAP } from "@/lib/gsap";

const text =
  "Мы стрижём не по шаблону. Сначала смотрим на форму головы, рост волос и то, как вы живёте. Потом берём ножницы.";

type StatementProps = {
  barbers: Barber[];
  reviews: Review[];
};

export function Statement({ barbers, reviews }: StatementProps) {
  const root = useRef<HTMLElement>(null);
  const averageRating = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : null;
  const experience = barbers.map((barber) => barber.experienceYears);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(ANY_MOTION, () => {
        gsap.fromTo(
          "[data-word]",
          { opacity: 0.14 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.08,
            scrollTrigger: {
              trigger: "[data-statement]",
              start: "top 80%",
              end: "bottom 55%",
              scrub: true,
            },
          },
        );
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="story" aria-label="Подход" className="border-t border-bone/10">
      <div className="container-page grid gap-12 py-28 lg:grid-cols-12 lg:py-44">
        <div className="lg:col-span-3">
          <dl className="grid grid-cols-2 gap-8 lg:sticky lg:top-32 lg:grid-cols-1">
            {averageRating && (
              <div>
                <dt className="text-sm text-ash">Средняя оценка гостей</dt>
                <dd className="mt-2 font-display text-3xl font-light tabular-nums">{averageRating}</dd>
              </div>
            )}
            {experience.length > 0 && (
              <div>
                <dt className="text-sm text-ash">Опыт мастеров</dt>
                <dd className="mt-2 font-display text-3xl font-light tabular-nums">
                  {Math.min(...experience)}-{Math.max(...experience)} лет
                </dd>
              </div>
            )}
          </dl>
        </div>

        <p
          data-statement
          className="font-display text-[clamp(1.75rem,3.7vw,3.6rem)] leading-[1.18] font-light tracking-[-0.03em] lg:col-span-9"
        >
          {text.split(" ").map((word, index) => (
            <span key={`${word}-${index}`}>
              <span data-word className="inline-block">
                {word}
              </span>{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
