import {
  barberDetailSchema,
  barberParamsSchema,
  barberSchema,
  type Barber,
  type BarberDetail,
} from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { notFound } from "../errors.js";
import { serviceSelect } from "./services.js";

const toTime = (value: Date) => value.toISOString().slice(11, 16);

const barberSelect = {
  id: true,
  name: true,
  photoUrl: true,
  bio: true,
  experienceYears: true,
  specialties: true,
  workingHours: { select: { weekday: true }, orderBy: { weekday: "asc" } },
} as const;

async function getRatings(app: FastifyInstance, barberIds: string[]) {
  const groups = await app.prisma.review.groupBy({
    by: ["barberId"],
    where: { barberId: { in: barberIds }, isPublic: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    groups.map((group) => [
      group.barberId,
      {
        rating: group._avg.rating === null ? null : Math.round(group._avg.rating * 10) / 10,
        reviewsCount: group._count._all,
      },
    ]),
  );
}

export async function barbersRoutes(app: FastifyInstance) {
  app.get("/api/v1/barbers", async (): Promise<Barber[]> => {
    const barbers = await app.prisma.barber.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: barberSelect,
    });
    const ratings = await getRatings(
      app,
      barbers.map((barber) => barber.id),
    );

    return z.array(barberSchema).parse(
      barbers.map(({ workingHours, ...barber }) => ({
        ...barber,
        rating: ratings.get(barber.id)?.rating ?? null,
        reviewsCount: ratings.get(barber.id)?.reviewsCount ?? 0,
        workdays: workingHours.map((item) => item.weekday),
      })),
    );
  });

  app.get("/api/v1/barbers/:id", async (request): Promise<BarberDetail> => {
    const { id } = barberParamsSchema.parse(request.params);

    const barber = await app.prisma.barber.findFirst({
      where: { id, isActive: true },
      select: {
        ...barberSelect,
        workingHours: {
          select: { weekday: true, startTime: true, endTime: true },
          orderBy: { weekday: "asc" },
        },
        breaks: {
          select: { weekday: true, startTime: true, endTime: true },
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
        services: {
          where: { isEnabled: true, service: { isActive: true } },
          select: { durationMin: true, price: true, service: { select: serviceSelect } },
          orderBy: { service: { sortOrder: "asc" } },
        },
      },
    });

    if (!barber) throw notFound("BARBER_NOT_FOUND", "Мастер не найден");

    const rating = (await getRatings(app, [id])).get(id);
    const schedule = (items: { weekday: number; startTime: Date; endTime: Date }[]) =>
      items.map((item) => ({
        weekday: item.weekday,
        startTime: toTime(item.startTime),
        endTime: toTime(item.endTime),
      }));

    return barberDetailSchema.parse({
      ...barber,
      rating: rating?.rating ?? null,
      reviewsCount: rating?.reviewsCount ?? 0,
      workdays: barber.workingHours.map((item) => item.weekday),
      workingHours: schedule(barber.workingHours),
      breaks: schedule(barber.breaks),
      services: barber.services.map((item) => ({
        ...item.service,
        durationMin: item.durationMin ?? item.service.durationMin,
        price: item.price ?? item.service.price,
      })),
    });
  });
}
