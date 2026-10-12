import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import type { PrismaClient } from "@barbershop/db";
import Fastify from "fastify";
import { webhookCallback, type Bot } from "grammy";
import type { AdminIdentity } from "./admin/auth";
import { registerErrorHandlers } from "./errors";
import { adminRoutes } from "./routes/admin";
import { availabilityRoutes } from "./routes/availability";
import { barbersRoutes } from "./routes/barbers";
import { bookingsRoutes } from "./routes/bookings";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import { reviewsRoutes } from "./routes/reviews";
import { servicesRoutes } from "./routes/services";
import type { TelegramAuthOptions } from "./telegram/auth";
import { createBot } from "./telegram/bot";
import { createNotifier, silentNotifier, type Notifier } from "./telegram/notifier";
import type { TelegramLinks } from "./telegram/shared";
import { unavailableStorage, type MediaStorage } from "./storage";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    telegram: TelegramAuthOptions;
    notifier: Notifier;
    bot: Bot | null;
  }
  interface FastifyRequest {
    admin: AdminIdentity | null;
  }
}

export type BotOptions = {
  token: string;
  mode: "off" | "polling" | "webhook";
  webhookSecret?: string;
  links: TelegramLinks;
};

type BuildAppOptions = {
  prisma: PrismaClient;
  corsOrigins: string[];
  telegram?: TelegramAuthOptions;
  /** Без bot уведомления не отправляются, webhook не регистрируется. */
  bot?: BotOptions;
  logger?: boolean;
  /** Secure-флаг cookie админки: в production только HTTPS. */
  secureCookies?: boolean;
  storage?: MediaStorage;
  botUsername?: string;
};

export const TELEGRAM_WEBHOOK_PATH = "/api/v1/telegram/webhook";

export async function buildApp({
  prisma,
  corsOrigins,
  telegram = { maxAgeSec: 86_400, allowDevAuth: false },
  bot: botOptions,
  logger = true,
  secureCookies = false,
  storage = unavailableStorage,
  botUsername,
}: BuildAppOptions) {
  const app = Fastify({ logger });

  app.decorate("prisma", prisma);
  app.decorate("telegram", telegram);
  app.decorateRequest("admin", null);
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  if (botOptions && botOptions.mode !== "off") {
    const deps = { prisma, links: botOptions.links, notifier: silentNotifier, log: app.log };
    const bot = createBot(botOptions.token, deps);
    deps.notifier = createNotifier({ api: bot.api, prisma, links: botOptions.links, log: app.log });
    app.decorate("notifier", deps.notifier);
    app.decorate("bot", bot);
  } else {
    app.decorate("notifier", silentNotifier);
    app.decorate("bot", null);
  }

  await app.register(cors, {
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart);

  registerErrorHandlers(app);

  await app.register(healthRoutes);
  await app.register(servicesRoutes);
  await app.register(barbersRoutes);
  await app.register(reviewsRoutes);
  await app.register(availabilityRoutes);
  await app.register(bookingsRoutes);
  await app.register(meRoutes);
  await app.register(adminRoutes, { secureCookies, storage, botUsername });

  if (app.bot && botOptions?.mode === "webhook") {
    app.post(
      TELEGRAM_WEBHOOK_PATH,
      webhookCallback(app.bot, "fastify", { secretToken: botOptions.webhookSecret }),
    );
  }

  return app;
}
