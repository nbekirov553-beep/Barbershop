import type { Barber, Service } from "@barbershop/shared";
import {
  ANY_BARBER,
  findBarber,
  formatDateLong,
  getEndTime,
  getSelectedServices,
  getTotals,
} from "@/lib/booking";
import { formatDuration, formatPrice } from "@/lib/format";

type BookingSummaryProps = {
  services: Service[];
  barbers: Barber[];
  serviceIds: string[];
  barberId: string | null;
  date: string | null;
  time: string | null;
};

function getBarberLabel(barbers: Barber[], barberId: string | null) {
  if (!barberId) return null;
  if (barberId === ANY_BARBER) return "Любой свободный";
  return findBarber(barbers, barberId)?.name ?? null;
}

export function BookingSummary({
  services,
  barbers,
  serviceIds,
  barberId,
  date,
  time,
}: BookingSummaryProps) {
  const selected = getSelectedServices(services, serviceIds);
  const totals = getTotals(services, serviceIds);
  const barberLabel = getBarberLabel(barbers, barberId);

  const rows = [
    { label: "Мастер", value: barberLabel },
    { label: "Дата", value: date ? formatDateLong(date) : null },
    {
      label: "Время",
      value: time ? `${time}-${getEndTime(time, totals.durationMin)}` : null,
    },
  ];

  return (
    <div className="border border-bone/15">
      <div className="border-b border-bone/15 px-5 py-4">
        <p className="text-sm text-ash">Ваша запись</p>
      </div>

      <div className="border-b border-bone/15 px-5 py-4">
        {selected.length === 0 ? (
          <p className="text-sm text-ash/70">Услуги не выбраны</p>
        ) : (
          <ul className="space-y-2">
            {selected.map((service) => (
              <li key={service.id} className="flex justify-between gap-4 text-sm">
                <span className="text-bone">{service.name}</span>
                <span className="shrink-0 text-ash tabular-nums">{formatPrice(service.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="border-b border-bone/15 px-5 py-4 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 py-1">
            <dt className="text-ash">{row.label}</dt>
            <dd className={row.value ? "text-right text-bone" : "text-ash/50"}>{row.value ?? "не выбрано"}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-end justify-between gap-4 px-5 py-5">
        <div>
          <p className="text-xs text-ash">Итого</p>
          <p className="mt-1 text-sm text-ash">
            {totals.durationMin ? formatDuration(totals.durationMin) : "0 мин"}
          </p>
        </div>
        <p className="font-display text-2xl font-light tabular-nums">{formatPrice(totals.price)}</p>
      </div>
    </div>
  );
}
