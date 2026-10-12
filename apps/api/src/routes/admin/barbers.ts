import type { Prisma, PrismaClient } from "@barbershop/db";
import {
  adminBarberInputSchema,
  adminBarberPatchSchema,
  adminBarberServicesSchema,
  adminPortfolioInputSchema,
  adminScheduleSchema,
  type AdminBarber,
} from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, notFound } from "../../errors";
import { BARBER_LINK_PREFIX, createBarberLinkCode } from "../../telegram/link-codes";

const idParams = z.object({ id: z.uuid({ error: "Некорректный id" }) });

/** Колонки TIME хранятся как Date на 1970-01-01 UTC. */
const toTime = (value: Date) => value.toISOString().slice(11, 16);
const fromTime = (value: string) => new Date(`1970-01-01T${value}:00Z`);

const barberInclude = {
  services: { select: { serviceId: true, isEnabled: true, durationMin: true, price: true } },
  workingHours: { orderBy: { weekday: "asc" } },
  breaks: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
  portfolio: { orderBy: { sortOrder: "asc" }, select: { id: true, imageUrl: true } },
} satisfies Prisma.BarberInclude;

async function loadAdminBarber(prisma: PrismaClient, id: string): Promise<AdminBarber> {
  const barber = await prisma.barber.findUnique({ where: { id }, include: barberInclude });
  if (!barber) throw notFound("BARBER_NOT_FOUND", "Мастер не найден");
  const schedule = (items: { weekday: number; startTime: Date; endTime: Date }[]) =>
    items.map((item) => ({ weekday: item.weekday, startTime: toTime(item.startTime), endTime: toTime(item.endTime) }));

  return {
    id: barber.id,
    name: barber.name,
    photoUrl: barber.photoUrl,
    bio: barber.bio,
    experienceYears: barber.experienceYears,
    specialties: barber.specialties,
    isActive: barber.isActive,
    sortOrder: barber.sortOrder,
    telegramLinked: barber.telegramChatId !== null,
    services: barber.services,
    workingHours: schedule(barber.workingHours),
    breaks: schedule(barber.breaks),
    portfolio: barber.portfolio,
  };
}

export async function adminBarbersRoutes(app: FastifyInstance, options: { botUsername?: string }) {
  app.get("/api/v1/admin/barbers", async (): Promise<AdminBarber[]> => {
    const barbers = await app.prisma.barber.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true },
    });
    return Promise.all(barbers.map((barber) => loadAdminBarber(app.prisma, barber.id)));
  });

  app.get("/api/v1/admin/barbers/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return loadAdminBarber(app.prisma, id);
  });

  app.post("/api/v1/admin/barbers", async (request, reply) => {
    const body = adminBarberInputSchema.parse(request.body);
    const last = await app.prisma.barber.aggregate({ _max: { sortOrder: true } });
    const services = await app.prisma.service.findMany({ select: { id: true } });
    const barber = await app.prisma.barber.create({
      data: {
        ...body,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        services: { create: services.map((service) => ({ serviceId: service.id })) },
      },
      select: { id: true },
    });
    return reply.status(201).send(await loadAdminBarber(app.prisma, barber.id));
  });

  app.patch("/api/v1/admin/barbers/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const body = adminBarberPatchSchema.parse(request.body);
    await loadAdminBarber(app.prisma, id);
    await app.prisma.barber.update({ where: { id }, data: body });
    return loadAdminBarber(app.prisma, id);
  });

  /** Записи ссылаются на мастера (ON DELETE RESTRICT): мастера с историей только скрывают. */
  app.delete("/api/v1/admin/barbers/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const bookings = await app.prisma.booking.count({ where: { barberId: id } });
    if (bookings > 0) {
      throw new AppError(409, "BARBER_HAS_BOOKINGS", "У мастера есть записи. Скройте его вместо удаления.");
    }
    const { count } = await app.prisma.barber.deleteMany({ where: { id } });
    if (count === 0) throw notFound("BARBER_NOT_FOUND", "Мастер не найден");
    return reply.status(204).send();
  });

  app.put("/api/v1/admin/barbers/:id/services", async (request) => {
    const { id } = idParams.parse(request.params);
    const items = adminBarberServicesSchema.parse(request.body);
    await loadAdminBarber(app.prisma, id);
    await app.prisma.$transaction(
      items.map((item) =>
        app.prisma.barberService.upsert({
          where: { barberId_serviceId: { barberId: id, serviceId: item.serviceId } },
          update: { isEnabled: item.isEnabled, durationMin: item.durationMin, price: item.price },
          create: { barberId: id, ...item },
        }),
      ),
    );
    return loadAdminBarber(app.prisma, id);
  });

  /** Недельный график и обеды заменяются целиком: так проще и нет «осиротевших» интервалов. */
  app.put("/api/v1/admin/barbers/:id/schedule", async (request) => {
    const { id } = idParams.parse(request.params);
    const schedule = adminScheduleSchema.parse(request.body);
    await loadAdminBarber(app.prisma, id);
    const toRow = (item: { weekday: number; startTime: string; endTime: string }) => ({
      barberId: id,
      weekday: item.weekday,
      startTime: fromTime(item.startTime),
      endTime: fromTime(item.endTime),
    });
    await app.prisma.$transaction([
      app.prisma.workingHours.deleteMany({ where: { barberId: id } }),
      app.prisma.break.deleteMany({ where: { barberId: id } }),
      app.prisma.workingHours.createMany({ data: schedule.workingHours.map(toRow) }),
      app.prisma.break.createMany({ data: schedule.breaks.map(toRow) }),
    ]);
    return loadAdminBarber(app.prisma, id);
  });

  app.post("/api/v1/admin/barbers/:id/portfolio", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { imageUrl } = adminPortfolioInputSchema.parse(request.body);
    await loadAdminBarber(app.prisma, id);
    const last = await app.prisma.portfolioItem.aggregate({ where: { barberId: id }, _max: { sortOrder: true } });
    await app.prisma.portfolioItem.create({
      data: { barberId: id, imageUrl, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
    return reply.status(201).send(await loadAdminBarber(app.prisma, id));
  });

  app.delete("/api/v1/admin/portfolio/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { count } = await app.prisma.portfolioItem.deleteMany({ where: { id } });
    if (count === 0) throw notFound("PORTFOLIO_NOT_FOUND", "Фото не найдено");
    return reply.status(204).send();
  });

  /** Одноразовая ссылка t.me/<bot>?start=barber_<code> для привязки чата мастера. */
  app.post("/api/v1/admin/barbers/:id/telegram-link", async (request) => {
    const { id } = idParams.parse(request.params);
    if (!options.botUsername) {
      throw new AppError(503, "BOT_NOT_CONFIGURED", "Не задан TELEGRAM_BOT_USERNAME");
    }
    await loadAdminBarber(app.prisma, id);
    const { code, expiresAt } = await createBarberLinkCode(app.prisma, id);
    return {
      url: `https://t.me/${options.botUsername}?start=${BARBER_LINK_PREFIX}${code}`,
      expiresAt: expiresAt.toISOString(),
    };
  });
}
