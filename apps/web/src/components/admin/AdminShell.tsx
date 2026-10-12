"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { adminApi } from "@/lib/admin-api";
import { useRemote } from "@/lib/use-remote";

const navItems = [
  { href: "/admin", label: "Сегодня" },
  { href: "/admin/bookings", label: "Записи" },
  { href: "/admin/barbers", label: "Барберы" },
  { href: "/admin/services", label: "Услуги" },
  { href: "/admin/schedule", label: "График" },
  { href: "/admin/time-off", label: "Исключения" },
  { href: "/admin/reviews", label: "Отзывы" },
  { href: "/admin/analytics", label: "Аналитика" },
  { href: "/admin/settings", label: "Настройки" },
];

const isActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useRemote("me", adminApi.me);
  const [isLeaving, setIsLeaving] = useState(false);

  const logout = async () => {
    setIsLeaving(true);
    await adminApi.logout().catch(() => undefined);
    router.replace("/admin/login");
  };

  const nav = (
    <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center px-3 text-sm whitespace-nowrap transition-colors lg:border-l-2 lg:px-4 ${
                active
                  ? "border-tungsten bg-bone/[0.06] text-bone"
                  : "border-transparent text-ash hover:text-bone"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 z-40 border-b border-bone/10 bg-graphite/95 backdrop-blur lg:flex lg:h-svh lg:flex-col lg:border-r lg:border-b-0 lg:py-8">
        <div className="flex h-14 items-center justify-between px-4 lg:mb-10 lg:h-auto lg:px-6">
          <Link href="/admin" className="font-display text-base font-medium tracking-[0.2em]">
            USTO
          </Link>
          <button type="button" onClick={logout} disabled={isLeaving} className="text-sm text-ash hover:text-bone lg:hidden">
            Выйти
          </button>
        </div>
        <nav aria-label="Разделы админки" className="overflow-x-auto px-2 pb-2 lg:flex-1 lg:overflow-visible lg:px-0 lg:pb-0">
          {nav}
        </nav>
        <div className="hidden px-6 lg:block">
          <p className="truncate text-sm text-bone">{me.data?.login ?? " "}</p>
          <div className="mt-2 flex gap-4 text-sm">
            <button type="button" onClick={logout} disabled={isLeaving} className="text-ash hover:text-bone">
              Выйти
            </button>
            <Link href="/" className="text-ash hover:text-bone">
              Сайт
            </Link>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
