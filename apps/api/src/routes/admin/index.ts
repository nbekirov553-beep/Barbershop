import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../admin/auth.js";
import type { MediaStorage } from "../../storage.js";
import { adminAnalyticsRoutes } from "./analytics.js";
import { adminAuthRoutes } from "./auth.js";
import { adminBarbersRoutes } from "./barbers.js";
import { adminBookingsRoutes } from "./bookings.js";
import { adminReviewsSettingsRoutes } from "./reviews-settings.js";
import { adminServicesRoutes } from "./services.js";
import { adminTimeOffRoutes } from "./time-off.js";
import { adminUploadsRoutes } from "./uploads.js";

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
