import type { Prisma, PrismaClient } from "@barbershop/db";
import {
  analyticsQuerySchema,
  type AnalyticsCancellations,
  type AnalyticsHeatmap,
  type AnalyticsLoad,
  type AnalyticsQuery,
  type AnalyticsRetention,
  type AnalyticsRevenue,
  type AnalyticsServices,
} from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import {
  computeCancellations,
  computeHeatmap,
  computeLoad,
  computeRetention,
  computeRevenue,
  computeServices,
  periodBounds,
  previousPeriod,
  type AnalyticsBarber,
  type AnalyticsBooking,
  type Period,
} from "../../domain/analytics.js";
import { loadSettings } from "../../domain/settings.js";

const bookingSelect = {
  clientId: true,
  barberId: true,
  startsAt: true,
  status: true,
  source: true,
  totalPrice: true,
  totalDurationMin: true,
  services: { select: { serviceId: true, name: true, price: true } },
} satisfies Prisma.BookingSelect;

/** TIME хранится как 1970-01-01THH:MM:00Z. */
const timeToMinutes = (value: Date) => value.getUTCHours() * 60 + value.getUTCMinutes();

async function loadBookings(prisma: PrismaClient, period: Period, barberId?: string): Promise<AnalyticsBooking[]> {
  const { start, end } = periodBounds(period);
  return prisma.booking.findMany({
    where: { startsAt: { gte: start, lt: end }, ...(barberId && { barberId }) },
    select: bookingSelect,
  });
}

/** Активные мастера и те, у кого были записи в периоде (даже если сейчас скрыты). */
async function loadBarbers(prisma: PrismaClient, bookings: AnalyticsBooking[], barberId?: string): Promise<AnalyticsBarber[]> {
  const withBookings = [...new Set(bookings.map((booking) => booking.barberId))];
  const barbers = await prisma.barber.findMany({
    where: barberId ? { id: barberId } : { OR: [{ isActive: true }, { id: { in: withBookings } }] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { workingHours: true, breaks: true },
  });
  const toItem = (item: { weekday: number; startTime: Date; endTime: Date }) => ({
    weekday: item.weekday,
    startMin: timeToMinutes(item.startTime),
    endMin: timeToMinutes(item.endTime),
  });
  return barbers.map((barber) => ({
    id: barber.id,
    name: barber.name,
    workingHours: barber.workingHours.map(toItem),
    breaks: barber.breaks.map(toItem),
  }));
}

async function resolvePeriod(prisma: PrismaClient, query: unknown) {
  const parsed: AnalyticsQuery = analyticsQuerySchema.parse(query);
  const { timezone } = await loadSettings(prisma);
  return { period: { from: parsed.from, to: parsed.to, timezone }, barberId: parsed.barberId };
}

export async function adminAnalyticsRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get("/api/v1/admin/analytics/revenue", async (request): Promise<AnalyticsRevenue> => {
    const { period, barberId } = await resolvePeriod(prisma, request.query);
    const [bookings, previous] = await Promise.all([
      loadBookings(prisma, period, barberId),
      loadBookings(prisma, { ...previousPeriod(period), timezone: period.timezone }, barberId),
    ]);
    return computeRevenue(bookings, previous, period);
  });

  app.get("/api/v1/admin/analytics/services", async (request): Promise<AnalyticsServices> => {
    const { period, barberId } = await resolvePeriod(prisma, request.query);
    return computeServices(await loadBookings(prisma, period, barberId));
  });

  app.get("/api/v1/admin/analytics/load", async (request): Promise<AnalyticsLoad> => {
    const { period, barberId } = await resolvePeriod(prisma, request.query);
    const { start, end } = periodBounds(period);
    const bookings = await loadBookings(prisma, period, barberId);
    const [barbers, timeOff] = await Promise.all([
      loadBarbers(prisma, bookings, barberId),
      prisma.timeOff.findMany({
        where: { startsAt: { lt: end }, endsAt: { gt: start } },
        select: { barberId: true, startsAt: true, endsAt: true },
      }),
    ]);
    return computeLoad(bookings, barbers, timeOff, period);
  });

  app.get("/api/v1/admin/analytics/heatmap", async (request): Promise<AnalyticsHeatmap> => {
    const { period, barberId } = await resolvePeriod(prisma, request.query);
    return computeHeatmap(await loadBookings(prisma, period, barberId), period);
  });

  app.get("/api/v1/admin/analytics/cancellations", async (request): Promise<AnalyticsCancellations> => {
    const { period, barberId } = await resolvePeriod(prisma, request.query);
    const bookings = await loadBookings(prisma, period, barberId);
    return computeCancellations(bookings, await loadBarbers(prisma, bookings, barberId));
  });

  app.get("/api/v1/admin/analytics/retention", async (request): Promise<AnalyticsRetention> => {
    const { period, barberId } = await resolvePeriod(prisma, request.query);
    const { start } = periodBounds(period);
    const bookings = await loadBookings(prisma, period, barberId);
    const clientIds = [...new Set(bookings.filter((booking) => booking.status === "completed").map((b) => b.clientId))];
    // С фильтром по мастеру «вернувшийся» — тот, кто уже был именно у этого мастера.
    const prior = await prisma.booking.findMany({
      where: { status: "completed", startsAt: { lt: start }, clientId: { in: clientIds }, ...(barberId && { barberId }) },
      select: { clientId: true },
      distinct: ["clientId"],
    });
    return computeRetention(bookings, new Set(prior.map((item) => item.clientId)));
  });
}
