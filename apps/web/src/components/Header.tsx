"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { shop } from "@/data/shop";

const navItems = [
  { href: "/#masters", label: "Мастера" },
  { href: "/#services", label: "Услуги" },
  { href: "/#booking", label: "Время" },
  { href: "/#contacts", label: "Контакты" },
];

const linkClass =
  "relative text-sm text-ash transition-colors duration-300 hover:text-bone after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-tungsten after:transition-transform after:duration-500 hover:after:origin-left hover:after:scale-x-100";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-graphite/90 via-graphite/50 to-transparent">
      <div className="container-page flex h-20 items-center justify-between">
        <Link href="/" onClick={close} className="relative z-10 font-display text-lg font-medium tracking-[0.2em]">
          {shop.name.toUpperCase()}
        </Link>

        <nav aria-label="Основная навигация" className="hidden md:block">
          <ul className="flex items-center gap-10">
            {navItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} className={linkClass}>
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/book" className={`${linkClass} text-bone`}>
                Записаться
              </Link>
            </li>
          </ul>
        </nav>

        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsOpen((value) => !value)}
          className="relative z-10 -mr-2 px-2 py-3 text-sm text-bone md:hidden"
        >
          {isOpen ? "Закрыть" : "Меню"}
        </button>
      </div>

      <nav
        id="mobile-nav"
        aria-label="Мобильная навигация"
        inert={!isOpen}
        className={`fixed inset-0 flex flex-col justify-between bg-graphite px-5 pt-28 pb-10 transition-[clip-path] duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] md:hidden ${
          isOpen ? "[clip-path:inset(0_0_0_0)]" : "[clip-path:inset(0_0_100%_0)]"
        }`}
      >
        <ul>
          {[...navItems, { href: "/book", label: "Записаться" }].map((item) => (
            <li key={item.href} className="border-b border-bone/10">
              <a
                href={item.href}
                onClick={close}
                className="text-display block py-5 text-[2.5rem] font-light"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <a href={shop.phoneHref} className="text-lg text-tungsten">
          {shop.phone}
        </a>
      </nav>
    </header>
  );
}
