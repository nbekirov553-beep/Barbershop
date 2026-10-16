import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import type { PrismaClient } from "@barbershop/db";
import Fastify, { type FastifyInstance } from "fastify";
import { webhookCallback, type Bot } from "grammy";
import type { AdminIdentity } from "./admin/auth.js";
import { registerErrorHandlers } from "./errors.js";
import { adminRoutes } from "./routes/admin/index.js";
import { availabilityRoutes } from "./routes/availability.js";
import { barbersRoutes } from "./routes/barbers.js";
import { bookingsRoutes } from "./routes/bookings.js";
import { dbHealthRoutes, healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { reviewsRoutes } from "./routes/reviews.js";
import { servicesRoutes } from "./routes/services.js";
import type { TelegramAuthOptions } from "./telegram/auth.js";
import { createBot } from "./telegram/bot.js";
import { createNotifier, silentNotifier, type Notifier } from "./telegram/notifier.js";
import type { TelegramLinks } from "./telegram/shared.js";
import { unavailableStorage, type MediaStorage } from "./storage.js";

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

export type ApiOptions = {
  prisma: PrismaClient;
  corsOrigins: string[];
  telegram?: TelegramAuthOptions;
  /** Без bot уведомления не отправляются, webhook не регистрируется. */
  bot?: BotOptions;
  /** Secure-флаг cookie админки: в production только HTTPS. */
  secureCookies?: boolean;
  storage?: MediaStorage;
  botUsername?: string;
};

export const TELEGRAM_WEBHOOK_PATH = "/api/v1/telegram/webhook";

/** Для тестов: Fastify с /health и всем API. Production-entrypoint — src/index.ts. */
export async function buildApp({ logger = true, ...options }: ApiOptions & { logger?: boolean }) {
  const app = Fastify({ logger });
  await app.register(healthRoutes);
  await registerApi(app, options);
  return app;
}

/**
 * Подключает API к уже созданному Fastify: декораторы, плагины, маршруты, Telegram webhook.
 * Вызывается на корневом инстансе (не через register), чтобы декораторы были видны всем маршрутам.
 */
export async function registerApi(
  app: FastifyInstance,
  {
    prisma,
    corsOrigins,
    telegram = { maxAgeSec: 86_400, allowDevAuth: false },
    bot: botOptions,
    secureCookies = false,
    storage = unavailableStorage,
    botUsername,
  }: ApiOptions,
) {
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

  await app.register(dbHealthRoutes);
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
}
