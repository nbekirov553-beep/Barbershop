import type { Service, ServiceCategory } from "@barbershop/shared";
import { formatDuration, formatPrice } from "@/lib/format";

const groups: { category: ServiceCategory; title: string }[] = [
  { category: "hair", title: "Стрижки" },
  { category: "beard", title: "Борода и бритьё" },
];

type StepServicesProps = {
  services: Service[];
  selected: string[];
  onToggle: (id: string) => void;
};

export function StepServices({ services, selected, onToggle }: StepServicesProps) {
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <fieldset key={group.category}>
          <legend className="text-sm text-ash">{group.title}</legend>
          <div className="mt-3 border-t border-bone/15">
            {services
              .filter((service) => service.category === group.category)
              .map((service) => {
                const isActive = selected.includes(service.id);
                return (
                  <label
                    key={service.id}
                    className="group flex cursor-pointer items-start gap-5 border-b border-bone/15 py-5 transition-colors duration-300 hover:bg-bone/[0.02] has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-tungsten"
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onToggle(service.id)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 grid size-4 shrink-0 place-items-center border transition-colors duration-200 ${
                        isActive ? "border-tungsten bg-tungsten" : "border-bone/30 group-hover:border-bone/60"
                      }`}
                    >
                      <span className={`size-1.5 bg-graphite ${isActive ? "block" : "hidden"}`} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-lg font-light tracking-[-0.02em] sm:text-xl">
                        {service.name}
                      </span>
                      <span className="mt-1 block text-sm text-ash">{service.description}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      <span className="block text-bone">{formatPrice(service.price)}</span>
                      <span className="mt-1 block text-ash">{formatDuration(service.durationMin)}</span>
                    </span>
                  </label>
                );
              })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
