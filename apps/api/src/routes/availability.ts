import {
  ANY_BARBER,
  addDays,
  availabilityDaysQuerySchema,
  availabilityQuerySchema,
  fromMinutes,
  type Availability,
  type AvailabilityDays,
} from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { computeAvailability, loadBookingContext, mergeSlots } from "../services/availability.js";

export async function availabilityRoutes(app: FastifyInstance) {
  const resolveExcluded = async (token: string | undefined) => {
    if (!token) return undefined;
    const booking = await app.prisma.booking.findUnique({
      where: { manageToken: token },
      select: { id: true },
    });
    return booking?.id;
  };

  app.get("/api/v1/availability", async (request): Promise<Availability> => {
    const query = availabilityQuerySchema.parse(request.query);
    const [context, excludeBookingId] = await Promise.all([
      loadBookingContext(app.prisma, query),
      resolveExcluded(query.excludeToken),
    ]);
    const map = await computeAvailability(app.prisma, context, {
      from: query.date,
      to: query.date,
      excludeBookingId,
    });
    const barber = query.barberId === ANY_BARBER ? null : context.barbers[0];

    return {
      date: query.date,
      timezone: context.settings.timezone,
      durationMin: barber?.durationMin ?? context.durationMin,
      price: barber?.price ?? context.price,
      slots: mergeSlots(map.get(query.date)).map(fromMinutes),
    };
  });

  app.get("/api/v1/availability/days", async (request): Promise<AvailabilityDays> => {
    const query = availabilityDaysQuerySchema.parse(request.query);
    const [context, excludeBookingId] = await Promise.all([
      loadBookingContext(app.prisma, query),
      resolveExcluded(query.excludeToken),
    ]);
    const to = addDays(context.today, context.settings.bookingHorizonDays - 1);
    const map = await computeAvailability(app.prisma, context, {
      from: context.today,
      to,
      excludeBookingId,
    });

    return {
      timezone: context.settings.timezone,
      today: context.today,
      days: [...map.entries()].map(([date, perBarber]) => ({
        date,
        available: mergeSlots(perBarber).length > 0,
      })),
    };
  });
}
