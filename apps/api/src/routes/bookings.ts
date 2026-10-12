import {
  bookingTokenParamsSchema,
  createBookingSchema,
  rescheduleBookingSchema,
  type BookingView,
} from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import {
  cancelBooking,
  createBooking,
  getBooking,
  rescheduleBooking,
} from "../services/bookings";
import { getTelegramUser } from "../telegram/auth";

export async function bookingsRoutes(app: FastifyInstance) {
  app.post("/api/v1/bookings", async (request, reply) => {
    const telegramUser = getTelegramUser(request, app.telegram) ?? undefined;
    const body = createBookingSchema.parse(request.body);
    const booking = await createBooking(app.prisma, body, { telegramUser });
    app.notifier.bookingCreated(booking.token);
    return reply.status(201).send(booking);
  });

  app.get("/api/v1/bookings/:token", async (request): Promise<BookingView> => {
    const { token } = bookingTokenParamsSchema.parse(request.params);
    return getBooking(app.prisma, token);
  });

  app.post("/api/v1/bookings/:token/cancel", async (request): Promise<BookingView> => {
    const { token } = bookingTokenParamsSchema.parse(request.params);
    const booking = await cancelBooking(app.prisma, token);
    app.notifier.bookingCancelled(token);
    return booking;
  });

  app.post("/api/v1/bookings/:token/reschedule", async (request): Promise<BookingView> => {
    const { token } = bookingTokenParamsSchema.parse(request.params);
    const { startsAt } = rescheduleBookingSchema.parse(request.body);
    const { booking, previous } = await rescheduleBooking(app.prisma, token, startsAt);
    app.notifier.bookingRescheduled(token, previous);
    return booking;
  });
}
