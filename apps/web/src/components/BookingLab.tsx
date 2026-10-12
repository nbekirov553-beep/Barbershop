import type { Barber, Service } from "@barbershop/shared";
import { BookingPreview } from "@/components/BookingPreview";
import { TashkentClock } from "@/components/TashkentClock";
import { shop } from "@/data/shop";

export function BookingLab({ barbers, services }: { barbers: Barber[]; services: Service[] }) {
  return (
    <section
      id="booking"
      aria-labelledby="booking-title"
      className="relative isolate overflow-hidden border-t border-bone/10 bg-graphite-2"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(236_235_230/0.04)_1px,transparent_1px)] bg-[size:calc(100%/6)_100%]"
      />

      <div className="container-page grid gap-16 py-28 lg:grid-cols-12 lg:items-end lg:py-40">
        <div className="lg:col-span-7">
          <p className="text-sm text-ash">Ташкент, сейчас</p>
          <TashkentClock className="text-display mt-4 block text-[clamp(4.5rem,15vw,13rem)] font-light text-bone" />
          <h2
            id="booking-title"
            className="mt-10 max-w-[18ch] font-display text-[clamp(1.6rem,3vw,2.75rem)] leading-[1.15] font-light tracking-[-0.03em]"
          >
            Посмотрите, кто свободен, и займите время
          </h2>
          <ul className="mt-10 grid gap-3 text-sm text-ash sm:grid-cols-2">
            {shop.hours.map((item) => (
              <li key={item.days} className="flex gap-4 border-t border-bone/10 pt-3">
                <span className="w-14 text-bone">{item.days}</span>
                <span className="tabular-nums">{item.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-5">
          <BookingPreview barbers={barbers} service={services[0]} />
        </div>
      </div>
    </section>
  );
}
