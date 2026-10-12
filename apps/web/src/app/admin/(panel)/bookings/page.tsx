"use client";

import { useState } from "react";
import type { AdminBooking, AdminBookingStatus } from "@barbershop/shared";
import { formatDateLong, formatPhone, formatPrice } from "@barbershop/shared/format";
import { addDays } from "@barbershop/shared/time";
import { BookingDetailsDialog, CreateBookingDialog, localDate, localTime } from "@/components/admin/booking-dialogs";
import { Button, Empty, Field, LoadState, PageHeader, StatusBadge, inputClass, statusLabels } from "@/components/admin/ui";
import { adminApi } from "@/lib/admin-api";
import { getTashkentToday } from "@/lib/booking";
import { useRemote } from "@/lib/use-remote";

const statuses = Object.keys(statusLabels) as AdminBookingStatus[];

export default function AdminBookingsPage() {
  const today = getTashkentToday();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 7));
  const [barberId, setBarberId] = useState("");
  const [status, setStatus] = useState<AdminBookingStatus | "">("");
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const barbers = useRemote("barbers", adminApi.barbers);
  const services = useRemote("services", adminApi.services);
  const isRangeValid = from <= to;
  const bookings = useRemote(isRangeValid ? `list:${from}:${to}:${barberId}:${status}` : null, () =>
    adminApi.bookings({ from, to, barberId: barberId || undefined, status: status || undefined }),
  );

  const groups = new Map<string, AdminBooking[]>();
  for (const booking of bookings.data ?? []) {
    const date = localDate(booking.startsAt);
    groups.set(date, [...(groups.get(date) ?? []), booking]);
  }

  return (
    <>
      <PageHeader
        title="Записи"
        description="Нажмите на запись, чтобы отметить визит, перенести или отменить."
        actions={
          <Button variant="primary" disabled={!barbers.data || !services.data} onClick={() => setIsCreating(true)}>
            Записать клиента
          </Button>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="С">
          {(id) => <input id={id} type="date" className={inputClass} value={from} onChange={(event) => setFrom(event.target.value)} />}
        </Field>
        <Field label="По" error={isRangeValid ? null : "Конец периода раньше начала"}>
          {(id) => (
            <input
              id={id}
              type="date"
              className={inputClass}
              value={to}
              aria-invalid={!isRangeValid}
              onChange={(event) => setTo(event.target.value)}
            />
          )}
        </Field>
        <Field label="Мастер">
          {(id) => (
            <select id={id} className={inputClass} value={barberId} onChange={(event) => setBarberId(event.target.value)}>
              <option value="">Все мастера</option>
              {barbers.data?.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Статус">
          {(id) => (
            <select
              id={id}
              className={inputClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminBookingStatus | "")}
            >
              <option value="">Все статусы</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {!isRangeValid ? null : bookings.status === "ready" && bookings.data.length === 0 ? (
        <Empty>За выбранный период записей нет.</Empty>
      ) : bookings.status !== "ready" ? (
        <LoadState status={bookings.status === "error" ? "error" : "loading"} onRetry={bookings.reload} />
      ) : (
        <div className={`space-y-10 ${bookings.isRefreshing ? "opacity-70" : ""}`}>
          {[...groups].map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-3 text-sm text-ash">{formatDateLong(date)}</h2>
              <ul className="divide-y divide-bone/10 border-y border-bone/10">
                {items.map((booking) => (
                  <li key={booking.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(booking)}
                      className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-x-4 gap-y-1 px-2 py-3 text-left transition-colors hover:bg-bone/[0.03] md:grid-cols-[4.5rem_1.2fr_1fr_1.4fr_7rem_6.5rem]"
                    >
                      <span className="text-sm tabular-nums">{localTime(booking.startsAt)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{booking.client.name}</span>
                        <span className="block text-xs text-ash tabular-nums">{formatPhone(booking.client.phone)}</span>
                      </span>
                      <span className="justify-self-end md:hidden">
                        <StatusBadge status={booking.status} />
                      </span>
                      <span className="col-start-2 col-end-4 truncate text-xs text-ash md:col-auto md:text-sm md:text-bone">
                        {booking.barber.name}
                        <span className="md:hidden">, {booking.services.join(", ")}</span>
                      </span>
                      <span className="hidden truncate text-sm text-ash md:block">{booking.services.join(", ")}</span>
                      <span className="hidden text-right text-sm tabular-nums md:block">{formatPrice(booking.totalPrice)}</span>
                      <span className="hidden justify-self-end md:block">
                        <StatusBadge status={booking.status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {barbers.data && services.data && (
        <CreateBookingDialog
          open={isCreating}
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            bookings.reload();
          }}
          barbers={barbers.data}
          services={services.data}
          defaultDate={today}
        />
      )}
      <BookingDetailsDialog
        booking={selected}
        onClose={() => setSelected(null)}
        onChanged={(booking) => {
          setSelected(booking);
          bookings.reload();
        }}
      />
    </>
  );
}
