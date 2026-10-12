"use client";

import Image from "next/image";
import { useRef } from "react";
import { CircleCta } from "@/components/CircleCta";
import { DESKTOP_MOTION, gsap, useGSAP } from "@/lib/gsap";

const lines = ["Точность", "в каждой", "линии"];
const caption = "Зал на Шахрисабз, 16. Четыре кресла, четыре мастера.";

export function HeroScene() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(DESKTOP_MOTION, () => {
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "+=130%",
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });

        tl.to("[data-hero-visual]", { clipPath: "inset(0% 0% 0% 0%)" }, 0)
          .fromTo("[data-hero-media]", { scale: 1.18 }, { scale: 1 }, 0)
          .to(
            "[data-hero-title]",
            { scale: 0.34, y: () => -window.innerHeight * 0.64, transformOrigin: "0% 100%" },
            0,
          )
          .to("[data-hero-meta]", { autoAlpha: 0, y: -48, duration: 0.35 }, 0)
          .to("[data-hero-shade]", { opacity: 1, duration: 0.6 }, 0.25)
          .to("[data-hero-light]", { opacity: 1, duration: 0.8 }, 0)
          .fromTo(
            "[data-hero-caption]",
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.3 },
            0.7,
          );
      });

      root.current?.setAttribute("data-ready", "");

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      aria-labelledby="hero-title"
      className="group/hero relative flex flex-col overflow-hidden lg:block lg:h-[100dvh]"
    >
      <div
        data-hero-light
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(70rem_45rem_at_25%_15%,rgb(227_168_87/0.1),transparent_65%)] opacity-0 lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[62%] hidden w-px bg-bone/[0.06] lg:block"
      />

      <div className="container-page relative z-10 order-1 pt-32 lg:flex lg:h-full lg:flex-col lg:justify-end lg:pt-0 lg:pb-[7vh]">
        <h1
          id="hero-title"
          data-hero-title
          className="text-display text-[clamp(3.4rem,9vw,9.25rem)] font-light will-change-transform"
        >
          {lines.map((line, index) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <span
                className="js-reveal block translate-y-[105%] group-data-ready/hero:animate-line-in"
                style={{ animationDelay: `${250 + index * 120}ms` }}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>

        <div
          data-hero-meta
          className="mt-10 lg:absolute lg:top-[69%] lg:right-[5%] lg:mt-0 lg:w-[33%]"
        >
          <div
            className="js-reveal flex items-end justify-between gap-8 opacity-0 group-data-ready/hero:animate-fade-in"
            style={{ animationDelay: "800ms" }}
          >
            <p className="max-w-[30ch] text-base leading-relaxed text-ash">
              Мужская парикмахерская у метро «Космонавтлар». Стрижка, борода и бритьё по записи,
              без очереди.
            </p>
            <CircleCta href="/book" label="Записаться" />
          </div>
        </div>
      </div>

      <div className="order-2 mt-14 px-5 pb-6 sm:px-8 lg:contents">
        <div
          data-hero-visual
          className="relative aspect-[4/5] overflow-hidden sm:aspect-[16/10] lg:absolute lg:inset-0 lg:aspect-auto lg:[clip-path:inset(16%_5%_34%_62%)]"
        >
          <div data-hero-media className="absolute inset-0 will-change-transform">
            <Image
              src="/images/interior.jpg"
              alt="Зал барбершопа Usto: кожаные кресла и круглые зеркала с подсветкой"
              fill
              priority
              sizes="100vw"
              className="photo-mono object-cover"
            />
          </div>
          <div
            data-hero-shade
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-graphite/70 via-graphite/10 to-graphite/80 opacity-0"
          />
          <p
            data-hero-caption
            className="invisible absolute right-[5%] bottom-[7vh] hidden max-w-[28ch] text-right text-base text-bone/80 opacity-0 lg:block"
          >
            {caption}
          </p>
        </div>
        <p className="mt-4 text-sm text-ash lg:hidden">{caption}</p>
      </div>
    </section>
  );
}
