import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../admin/auth";
import type { MediaStorage } from "../../storage";
import { adminAnalyticsRoutes } from "./analytics";
import { adminAuthRoutes } from "./auth";
import { adminBarbersRoutes } from "./barbers";
import { adminBookingsRoutes } from "./bookings";
import { adminReviewsSettingsRoutes } from "./reviews-settings";
import { adminServicesRoutes } from "./services";
import { adminTimeOffRoutes } from "./time-off";
import { adminUploadsRoutes } from "./uploads";

export type AdminRoutesOptions = {
  secureCookies: boolean;
  storage: MediaStorage;
  botUsername?: string;
};

export async function adminRoutes(app: FastifyInstance, options: AdminRoutesOptions) {
  await app.register(adminAuthRoutes, { secureCookies: options.secureCookies });

  // Хук внутри register действует только на маршруты этой группы (инкапсуляция Fastify).
  await app.register(async (protectedApp) => {
    protectedApp.addHook("onRequest", async (request) => {
      await requireAdmin(request);
    });
    await protectedApp.register(adminBookingsRoutes);
    await protectedApp.register(adminServicesRoutes);
    await protectedApp.register(adminBarbersRoutes, { botUsername: options.botUsername });
    await protectedApp.register(adminTimeOffRoutes);
    await protectedApp.register(adminReviewsSettingsRoutes);
    await protectedApp.register(adminUploadsRoutes, { storage: options.storage });
    await protectedApp.register(adminAnalyticsRoutes);
  });
}
