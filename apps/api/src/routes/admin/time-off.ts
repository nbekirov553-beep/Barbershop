import type { PrismaClient } from "@barbershop/db";
import {
  adminTimeOffInputSchema,
  adminTimeOffQuerySchema,
  toMinutes,
  toZoned,
  zonedToUtc,
  type AdminTimeOff,
} from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadSettings } from "../../domain/settings.js";
import { notFound } from "../../errors.js";

const idParams = z.object({ id: z.uuid({ error: "Некорректный id" }) });

/** 2026-10-09T14:30 в часовом поясе салона → UTC. */
const fromLocal = (value: string, timezone: string) =>
  zonedToUtc(value.slice(0, 10), toMinutes(value.slice(11, 16)), timezone);

const toLocal = (value: Date, timezone: string) => {
  const zoned = toZoned(value, timezone);
  return `${zoned.date}T${zoned.time}`;
};

type TimeOffRow = {
  id: string;
  barberId: string | null;
  startsAt: Date;
  endsAt: Date;
  type: AdminTimeOff["type"];
  note: string | null;
  barber: { name: string } | null;
};

async function toAdminTimeOff(prisma: PrismaClient, item: TimeOffRow, timezone: string): Promise<AdminTimeOff> {
  const conflicts = await prisma.booking.count({
    where: {
      status: "confirmed",
      startsAt: { lt: item.endsAt },
      endsAt: { gt: item.startsAt },
      ...(item.barberId && { barberId: item.barberId }),
    },
  });
  return {
    id: item.id,
    barberId: item.barberId,
    barberName: item.barber?.name ?? null,
    type: item.type,
    note: item.note,
    from: toLocal(item.startsAt, timezone),
    to: toLocal(item.endsAt, timezone),
    conflicts,
  };
}

const timeOffInclude = { barber: { select: { name: true } } } as const;

export async function adminTimeOffRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/time-off", async (request): Promise<AdminTimeOff[]> => {
    const query = adminTimeOffQuerySchema.parse(request.query);
    const { timezone } = await loadSettings(app.prisma);
    const from = query.from ? zonedToUtc(query.from, 0, timezone) : new Date();
    const items = await app.prisma.timeOff.findMany({
      where: { endsAt: { gt: from } },
      orderBy: { startsAt: "asc" },
      include: timeOffInclude,
    });
    return Promise.all(items.map((item) => toAdminTimeOff(app.prisma, item, timezone)));
  });

  app.post("/api/v1/admin/time-off", async (request, reply) => {
    const body = adminTimeOffInputSchema.parse(request.body);
    const { timezone } = await loadSettings(app.prisma);
    const item = await app.prisma.timeOff.create({
      data: {
        barberId: body.barberId,
        type: body.type,
        note: body.note,
        startsAt: fromLocal(body.from, timezone),
        endsAt: fromLocal(body.to, timezone),
      },
      include: timeOffInclude,
    });
    return reply.status(201).send(await toAdminTimeOff(app.prisma, item, timezone));
  });

  app.put("/api/v1/admin/time-off/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const body = adminTimeOffInputSchema.parse(request.body);
    const { timezone } = await loadSettings(app.prisma);
    const exists = await app.prisma.timeOff.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound("TIME_OFF_NOT_FOUND", "Исключение не найдено");
    const item = await app.prisma.timeOff.update({
      where: { id },
      data: {
        barberId: body.barberId,
        type: body.type,
        note: body.note,
        startsAt: fromLocal(body.from, timezone),
        endsAt: fromLocal(body.to, timezone),
      },
      include: timeOffInclude,
    });
    return toAdminTimeOff(app.prisma, item, timezone);
  });

  app.delete("/api/v1/admin/time-off/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { count } = await app.prisma.timeOff.deleteMany({ where: { id } });
    if (count === 0) throw notFound("TIME_OFF_NOT_FOUND", "Исключение не найдено");
    return reply.status(204).send();
  });
}
