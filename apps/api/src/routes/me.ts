import type { Me, MyBookings } from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { listTelegramBookings } from "../services/bookings.js";
import { requireTelegramUser } from "../telegram/auth.js";

export async function meRoutes(app: FastifyInstance) {
  app.get("/api/v1/me", async (request): Promise<Me> => {
    const telegramUser = requireTelegramUser(request, app.telegram);
    const client = await app.prisma.client.findUnique({
      where: { telegramId: BigInt(telegramUser.id) },
      select: { name: true, phone: true },
    });
    return { telegramUser, client };
  });

  app.get("/api/v1/me/bookings", async (request): Promise<MyBookings> => {
    const telegramUser = requireTelegramUser(request, app.telegram);
    return listTelegramBookings(app.prisma, telegramUser);
  });
}
