"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminBooking } from "@barbershop/shared";
import { formatDateLong, formatPrice, pluralize } from "@barbershop/shared/format";
import { addDays } from "@barbershop/shared/time";
import { BookingDetailsDialog, CreateBookingDialog } from "@/components/admin/booking-dialogs";
import { DayBoard } from "@/components/admin/DayBoard";
import { Button, Empty, LoadState, PageHeader } from "@/components/admin/ui";
import { adminApi } from "@/lib/admin-api";
import { getTashkentToday } from "@/lib/booking";
import { useRemote } from "@/lib/use-remote";

export default function AdminTodayPage() {
  const today = getTashkentToday();
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const barbers = useRemote("barbers", adminApi.barbers);
  const services = useRemote("services", adminApi.services);
  const bookings = useRemote(`day:${date}`, () => adminApi.bookings({ from: date, to: date }));

  const active = bookings.data?.filter((booking) => booking.status !== "cancelled") ?? [];
  const cancelled = (bookings.data?.length ?? 0) - active.length;
  const revenue = active.filter((booking) => booking.status !== "no_show").reduce((sum, booking) => sum + booking.totalPrice, 0);
  const title = date === today ? "Сегодня" : date === addDays(today, 1) ? "Завтра" : formatDateLong(date);

  return (
    <>
      <PageHeader
        title={title}
        description={
          bookings.data
            ? `${pluralize(active.length, ["запись", "записи", "записей"])} на ${formatPrice(revenue)}${
                cancelled ? `, отменено ${cancelled}` : ""
              }`
            : undefined
        }
        actions={
          <>
            <div className="flex">
              <Button aria-label="Предыдущий день" onClick={() => setDate(addDays(date, -1))}>
                Назад
              </Button>
              <Button className="-ml-px" disabled={date === today} onClick={() => setDate(today)}>
                Сегодня
              </Button>
              <Button className="-ml-px" aria-label="Следующий день" onClick={() => setDate(addDays(date, 1))}>
                Вперёд
              </Button>
            </div>
            <Button variant="primary" disabled={!barbers.data || !services.data} onClick={() => setIsCreating(true)}>
              Записать клиента
            </Button>
          </>
        }
      />

      {barbers.status !== "ready" || bookings.status === "error" || (bookings.status === "loading" && !bookings.data) ? (
        <LoadState
          status={barbers.status === "error" || bookings.status === "error" ? "error" : "loading"}
          onRetry={() => {
            barbers.reload();
            bookings.reload();
          }}
        />
      ) : barbers.data.length === 0 ? (
        <Empty action={<Link href="/admin/barbers" className="text-sm underline underline-offset-4">Добавить мастера</Link>}>
          Мастеров пока нет. Добавьте первого, чтобы принимать записи.
        </Empty>
      ) : (
        <div className={bookings.isRefreshing ? "opacity-70 transition-opacity" : "transition-opacity"}>
          <DayBoard date={date} barbers={barbers.data} bookings={bookings.data ?? []} onSelect={setSelected} />
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
          defaultDate={date}
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
