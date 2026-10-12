"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { shop } from "@/data/shop";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container-page flex min-h-[100svh] flex-col justify-end pt-32 pb-16">
      <p className="text-sm text-tungsten">Сервис временно недоступен</p>
      <h1 className="text-display mt-4 max-w-[16ch] text-[clamp(2.5rem,7vw,6.5rem)] font-light">
        Не удалось загрузить данные
      </h1>
      <div className="mt-12 grid gap-10 border-t border-bone/15 pt-8 sm:grid-cols-[1fr_auto] sm:items-end">
        <p className="max-w-[44ch] text-ash">
          Попробуйте обновить страницу через минуту. Записаться можно и по телефону {shop.phone}.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={retry}
            className="flex h-14 items-center justify-center bg-bone px-8 text-sm font-medium text-graphite transition-colors duration-300 hover:bg-tungsten"
          >
            Повторить
          </button>
          <a
            href={shop.phoneHref}
            className="flex h-14 items-center justify-center border border-bone/25 px-8 text-sm text-bone transition-colors duration-300 hover:border-tungsten hover:text-tungsten"
          >
            Позвонить
          </a>
        </div>
      </div>
    </main>
  );
}
