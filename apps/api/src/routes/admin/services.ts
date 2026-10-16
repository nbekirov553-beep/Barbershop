import {
  adminServiceInputSchema,
  adminServicePatchSchema,
  type AdminService,
} from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, notFound } from "../../errors.js";

const idParams = z.object({ id: z.uuid({ error: "Некорректный id услуги" }) });

const serviceSelect = {
  id: true,
  name: true,
  description: true,
  category: true,
  durationMin: true,
  price: true,
  isActive: true,
  sortOrder: true,
} as const;

export async function adminServicesRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/services", async (): Promise<AdminService[]> =>
    app.prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: serviceSelect }),
  );

  app.post("/api/v1/admin/services", async (request, reply) => {
    const body = adminServiceInputSchema.parse(request.body);
    const last = await app.prisma.service.aggregate({ _max: { sortOrder: true } });
    const barbers = await app.prisma.barber.findMany({ select: { id: true } });
    const service = await app.prisma.service.create({
      data: {
        ...body,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        // Новая услуга сразу доступна у всех мастеров; отключить можно в карточке мастера.
        barbers: { create: barbers.map((barber) => ({ barberId: barber.id })) },
      },
      select: serviceSelect,
    });
    return reply.status(201).send(service);
  });

  app.patch("/api/v1/admin/services/:id", async (request): Promise<AdminService> => {
    const { id } = idParams.parse(request.params);
    const body = adminServicePatchSchema.parse(request.body);
    const exists = await app.prisma.service.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound("SERVICE_NOT_FOUND", "Услуга не найдена");
    return app.prisma.service.update({ where: { id }, data: body, select: serviceSelect });
  });

  /** Прошлые записи хранят снимок услуги, поэтому удаление их не ломает; будущие — блокируют удаление. */
  app.delete("/api/v1/admin/services/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const upcoming = await app.prisma.bookingService.count({
      where: { serviceId: id, booking: { status: "confirmed", endsAt: { gt: new Date() } } },
    });
    if (upcoming > 0) {
      throw new AppError(409, "SERVICE_IN_USE", `На услугу есть будущие записи (${upcoming}). Скройте её вместо удаления.`);
    }
    const { count } = await app.prisma.service.deleteMany({ where: { id } });
    if (count === 0) throw notFound("SERVICE_NOT_FOUND", "Услуга не найдена");
    return reply.status(204).send();
  });
}
