"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Barber, BookingView, Service } from "@barbershop/shared";
import { toZoned } from "@barbershop/shared/time";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { TelegramNotifyLink } from "@/components/booking/TelegramNotifyLink";
import { shop } from "@/data/shop";

type BookingConfirmationProps = {
  services: Service[];
  barbers: Barber[];
  booking: BookingView;
  onRestart: () => void;
};

export function BookingConfirmation({ services, barbers, booking, onRestart }: BookingConfirmationProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const start = toZoned(new Date(booking.startsAt), booking.timezone);
  const manageHref = `/booking/${booking.token}`;

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className="grid animate-fade-in gap-12 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="text-sm text-tungsten">Запись подтверждена</p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-display mt-4 text-[clamp(2.75rem,7vw,6.5rem)] font-light outline-none"
        >
          Ждём вас, {booking.client.name}
        </h1>
        <p className="mt-8 max-w-[46ch] text-ash">
          Мы напомним о визите накануне. Сохраните ссылку ниже: по ней можно перенести или отменить
          запись не позднее чем за {booking.cancelCutoffMin} минут до начала.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href={manageHref}
            className="flex h-14 items-center justify-center bg-bone px-8 text-sm font-medium text-graphite transition-colors duration-300 hover:bg-tungsten"
          >
            Управлять записью
          </Link>
          <button
            type="button"
            onClick={onRestart}
            className="flex h-14 items-center justify-center border border-bone/25 px-8 text-sm text-bone transition-colors duration-300 hover:border-tungsten hover:text-tungsten"
          >
            Записаться ещё
          </button>
        </div>
        <Link href="/" className="mt-6 inline-block text-sm text-ash transition-colors hover:text-bone">
          На главную
        </Link>
      </div>

      <div className="lg:col-span-5">
        <BookingSummary
          services={services}
          barbers={barbers}
          serviceIds={booking.serviceIds}
          barberId={booking.barber.id}
          date={start.date}
          time={start.time}
        />
        <TelegramNotifyLink token={booking.token} className="mt-4" />
        <p className="mt-4 text-sm text-ash">
          {shop.address}. {shop.landmark}. Телефон:{" "}
          <span className="whitespace-nowrap">{shop.phone}</span>
        </p>
      </div>
    </div>
  );
}
