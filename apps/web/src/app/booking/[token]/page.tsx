import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingManage } from "@/components/booking/BookingManage";
import { Header } from "@/components/Header";
import { ApiRequestError, getBooking } from "@/lib/api";
import { getTashkentToday } from "@/lib/booking";

export const metadata: Metadata = {
  title: "Ваша запись | Usto",
  robots: { index: false, follow: false },
};

type BookingPageProps = {
  params: Promise<{ token: string }>;
};

async function loadBooking(token: string) {
  try {
    return await getBooking(token);
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { token } = await params;
  const booking = await loadBooking(token);

  return (
    <>
      <Header />
      <main className="container-page min-h-[100svh] pt-32 pb-16 lg:pb-28">
        <BookingManage initialBooking={booking} today={getTashkentToday()} />
      </main>
    </>
  );
}
