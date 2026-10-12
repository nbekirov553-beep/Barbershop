import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { Header } from "@/components/Header";
import { getBarbers, getServices } from "@/lib/api";
import { BOOKING_HORIZON_DAYS, addDays, getTashkentToday } from "@/lib/booking";

export const metadata: Metadata = {
  title: "Запись | Usto",
};

type BookPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function BookPage({ searchParams }: BookPageProps) {
  const [params, services, barbers] = await Promise.all([searchParams, getServices(), getBarbers()]);
  const today = getTashkentToday();
  const lastDay = addDays(today, BOOKING_HORIZON_DAYS - 1);

  const barber = pick(params.barber);
  const time = pick(params.time);
  const date = pick(params.date);
  const service = pick(params.service);
  const validTime = time && /^\d{2}:\d{2}$/.test(time) ? time : null;
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && date <= lastDay ? date : null;

  return (
    <>
      <Header />
      <main className="container-page min-h-[100svh] pt-32 pb-16 lg:pb-28">
        <BookingFlow
          services={services}
          barbers={barbers}
          today={today}
          initialBarberId={barbers.some((item) => item.id === barber) ? (barber ?? null) : null}
          initialDate={validTime ? (validDate ?? today) : validDate}
          initialTime={validTime}
          initialServiceIds={services.some((item) => item.id === service) && service ? [service] : []}
        />
      </main>
    </>
  );
}
