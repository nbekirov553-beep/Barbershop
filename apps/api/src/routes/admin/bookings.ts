import type { Prisma, PrismaClient } from "@barbershop/db";
import {
  adminAvailabilityQuerySchema,
  adminBookingsQuerySchema,
  adminCreateBookingSchema,
  adminUpdateBookingSchema,
  addDays,
  daysBetween,
  fromMinutes,
  zonedToUtc,
  type AdminBooking,
} from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadSettings } from "../../domain/settings.js";
import { AppError, notFound } from "../../errors.js";
import { computeAvailability, loadBookingContext } from "../../services/availability.js";
import { cancelBooking, createBooking, rescheduleBooking } from "../../services/bookings.js";

const MAX_RANGE_DAYS = 62;
const idParams = z.object({ id: z.uuid({ error: "Некорректный id записи" }) });

const adminBookingInclude = {
  barber: { select: { id: true, name: true } },
  client: { select: { name: true, phone: true, telegramId: true, telegramChatId: true } },
  services: { select: { serviceId: true, name: true } },
} as const;

type AdminBookingRow = Prisma.BookingGetPayload<{ include: typeof adminBookingInclude }>;

const toAdminBooking = (booking: AdminBookingRow): AdminBooking => ({
  id: booking.id,
  token: booking.manageToken,
  status: booking.status,
  source: booking.source,
  startsAt: booking.startsAt.toISOString(),
  endsAt: booking.endsAt.toISOString(),
  totalPrice: booking.totalPrice,
  totalDurationMin: booking.totalDurationMin,
  barber: booking.barber,
  client: {
    name: booking.client.name,
    phone: booking.client.phone,
    hasTelegram: booking.client.telegramChatId !== null || booking.client.telegramId !== null,
  },
  services: booking.services.map((service) => service.name),
  serviceIds: booking.services.map((service) => service.serviceId).filter((id): id is string => id !== null),
  autoCompleted: booking.autoCompletedAt !== null,
});

async function getAdminBooking(prisma: PrismaClient, where: Prisma.BookingWhereUniqueInput) {
  const booking = await prisma.booking.findUnique({ where, include: adminBookingInclude });
  if (!booking) throw notFound("BOOKING_NOT_FOUND", "Запись не найдена");
  return booking;
}

export async function adminBookingsRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/bookings", async (request): Promise<AdminBooking[]> => {
    const query = adminBookingsQuerySchema.parse(request.query);
    const span = daysBetween(query.from, query.to);
    if (span < 0 || span > MAX_RANGE_DAYS) {
      throw new AppError(400, "INVALID_RANGE", `Период — от 1 до ${MAX_RANGE_DAYS + 1} дней`);
    }

    const { timezone } = await loadSettings(app.prisma);
    const bookings = await app.prisma.booking.findMany({
      where: {
        startsAt: { gte: zonedToUtc(query.from, 0, timezone), lt: zonedToUtc(addDays(query.to, 1), 0, timezone) },
        ...(query.barberId && { barberId: query.barberId }),
        ...(query.status && { status: query.status }),
      },
      orderBy: { startsAt: "asc" },
      include: adminBookingInclude,
    });
    return bookings.map(toAdminBooking);
  });

  app.get("/api/v1/admin/availability", async (request) => {
    const query = adminAvailabilityQuerySchema.parse(request.query);
    const context = await loadBookingContext(app.prisma, query);
    const barber = context.barbers.find((item) => item.id === query.barberId);
    const available = await computeAvailability(app.prisma, context, {
      from: query.date,
      to: query.date,
      excludeBookingId: query.excludeId,
      admin: true,
    });
    return {
      timezone: context.settings.timezone,
      durationMin: barber?.durationMin ?? context.durationMin,
      price: barber?.price ?? context.price,
      slots: (available.get(query.date)?.get(query.barberId) ?? []).map(fromMinutes),
    };
  });

  app.post("/api/v1/admin/bookings", async (request, reply) => {
    const body = adminCreateBookingSchema.parse(request.body);
    const created = await createBooking(app.prisma, body, { admin: true });
    app.notifier.bookingCreated(created.token);
    return reply.status(201).send(toAdminBooking(await getAdminBooking(app.prisma, { manageToken: created.token })));
  });

  app.patch("/api/v1/admin/bookings/:id", async (request): Promise<AdminBooking> => {
    const { id } = idParams.parse(request.params);
    const body = adminUpdateBookingSchema.parse(request.body);
    const booking = await getAdminBooking(app.prisma, { id });
    const token = booking.manageToken;

    if ("startsAt" in body) {
      const { previous } = await rescheduleBooking(app.prisma, token, body.startsAt, { admin: true });
      app.notifier.bookingRescheduled(token, previous);
    } else if (body.status === "cancelled") {
      await cancelBooking(app.prisma, token, { admin: true });
      app.notifier.bookingCancelled(token);
    } else {
      if (booking.status === "cancelled") {
        throw new AppError(409, "BOOKING_CANCELLED", "Отменённую запись нельзя отметить");
      }
      if (booking.startsAt > new Date()) {
        throw new AppError(422, "VISIT_NOT_STARTED", "Отметить визит можно после его начала");
      }
      await app.prisma.booking.update({ where: { id }, data: { status: body.status } });
    }

    return toAdminBooking(await getAdminBooking(app.prisma, { id }));
  });
}
