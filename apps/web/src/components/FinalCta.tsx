"use client";

import { useRef } from "react";
import { CircleCta } from "@/components/CircleCta";
import { shop } from "@/data/shop";
import { ANY_MOTION, gsap, useGSAP } from "@/lib/gsap";

const lines = ["Ваше кресло", "ждёт"];
const mapSrc = `https://yandex.ru/map-widget/v1/?ll=${shop.coords.lng}%2C${shop.coords.lat}&z=16&pt=${shop.coords.lng}%2C${shop.coords.lat}%2Cpm2wtm`;

const linkClass = "transition-colors duration-300 hover:text-tungsten";

export function FinalCta() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(ANY_MOTION, () => {
        gsap.from("[data-final-line]", {
          yPercent: 105,
          duration: 1.3,
          ease: "expo.out",
          stagger: 0.12,
          scrollTrigger: { trigger: "[data-final-title]", start: "top 85%", once: true },
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="contacts" aria-labelledby="final-title" className="border-t border-bone/10">
      <div className="container-page pt-28 lg:pt-40">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="final-title"
            data-final-title
            className="text-display text-[clamp(3.2rem,10vw,10.5rem)] font-light"
          >
            {lines.map((line) => (
              <span key={line} className="block overflow-hidden pb-[0.06em]">
                <span data-final-line className="block">
                  {line}
                </span>
              </span>
            ))}
          </h2>
          <div className="lg:mb-6">
            <CircleCta href="/book" label="Записаться" size="lg" />
          </div>
        </div>

        <div className="mt-24 grid gap-10 border-t border-bone/15 pt-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-ash">Адрес</h3>
            <p className="mt-3 text-bone">
              {shop.city}, {shop.address}
            </p>
            <p className="mt-1 text-ash">{shop.landmark}</p>
          </div>
          <div>
            <h3 className="text-ash">Часы</h3>
            <ul className="mt-3 space-y-1">
              {shop.hours.map((item) => (
                <li key={item.days} className="flex gap-4 tabular-nums">
                  <span className="w-12 text-bone">{item.days}</span>
                  <span>{item.time}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-ash">Телефон</h3>
            <a href={shop.phoneHref} className={`mt-3 block text-bone ${linkClass}`}>
              {shop.phone}
            </a>
          </div>
          <div>
            <h3 className="text-ash">Мессенджеры</h3>
            <ul className="mt-3 space-y-1 text-bone">
              <li>
                <a href={shop.telegram} target="_blank" rel="noreferrer" className={linkClass}>
                  Telegram
                </a>
              </li>
              <li>
                <a href={shop.instagram} target="_blank" rel="noreferrer" className={linkClass}>
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-20 h-[55vh] min-h-80 border-y border-bone/10">
        <iframe
          title={`Карта: ${shop.address}`}
          src={mapSrc}
          loading="lazy"
          className="h-full w-full [filter:grayscale(1)_invert(0.92)_contrast(0.9)]"
        />
      </div>

      <footer className="container-page flex flex-col gap-2 py-8 text-xs text-ash sm:flex-row sm:justify-between">
        <span>
          {shop.name}. {shop.tagline}, {shop.city}
        </span>
        <span>© 2026</span>
      </footer>
    </section>
  );
}
