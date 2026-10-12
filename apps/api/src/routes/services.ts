import { serviceSchema, type Service } from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export const serviceSelect = {
  id: true,
  name: true,
  description: true,
  category: true,
  durationMin: true,
  price: true,
} as const;

export async function servicesRoutes(app: FastifyInstance) {
  app.get("/api/v1/services", async (): Promise<Service[]> => {
    const services = await app.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: serviceSelect,
    });
    return z.array(serviceSchema).parse(services);
  });
}
