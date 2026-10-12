import type { Service, ServiceCategory } from "@barbershop/shared";
import { formatDuration, formatPrice } from "@/lib/format";

const groups: { category: ServiceCategory; title: string }[] = [
  { category: "hair", title: "Стрижки" },
  { category: "beard", title: "Борода и бритьё" },
];

export function ServicesIndex({ services }: { services: Service[] }) {
  return (
    <section id="services" aria-labelledby="services-title" className="border-t border-bone/10">
      <div className="container-page grid gap-16 py-28 lg:grid-cols-12 lg:py-40">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <h2
              id="services-title"
              className="text-display text-[clamp(2.75rem,6vw,5.5rem)] font-light"
            >
              Услуги
            </h2>
            <p className="mt-6 max-w-[32ch] text-ash">
              Цена фиксированная и не зависит от мастера. Мытьё головы и укладка входят в стрижку.
            </p>
          </div>
        </div>

        <div className="space-y-16 lg:col-span-8">
          {groups.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm text-ash">{group.title}</h3>
              <ul className="mt-4 border-t border-bone/15">
                {services
                  .filter((service) => service.category === group.category)
                  .map((service) => (
                    <li
                      key={service.id}
                      className="group relative grid gap-2 border-b border-bone/15 py-7 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 left-0 h-px w-0 bg-tungsten transition-[width] duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:w-6"
                      />
                      <div className="transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:translate-x-10">
                        <p className="font-display text-[clamp(1.25rem,2.2vw,1.9rem)] font-light tracking-[-0.02em]">
                          {service.name}
                        </p>
                        <p className="mt-2 text-sm text-ash">{service.description}</p>
                      </div>
                      <p className="flex gap-6 text-sm tabular-nums sm:justify-end">
                        <span className="text-ash">{formatDuration(service.durationMin)}</span>
                        <span className="text-bone">{formatPrice(service.price)}</span>
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
