import { createPrismaClient } from "@barbershop/db";
import { buildApp } from "./app";
import { env } from "./env";
import { createSupabaseStorage } from "./storage";

export const links = { appUrl: env.APP_URL.replace(/\/$/, ""), miniAppUrl: env.MINIAPP_URL };

/** Приложение из переменных окружения: общее для локального сервера и serverless-функции. */
export function createServerApp() {
  return buildApp({
    prisma: createPrismaClient(env.DATABASE_URL),
    corsOrigins: env.CORS_ORIGINS,
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN,
      maxAgeSec: env.TELEGRAM_INIT_DATA_TTL_SEC,
      allowDevAuth: env.TELEGRAM_DEV_AUTH,
    },
    bot: env.TELEGRAM_BOT_TOKEN
      ? {
          token: env.TELEGRAM_BOT_TOKEN,
          mode: env.TELEGRAM_BOT_MODE,
          webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
          links,
        }
      : undefined,
    secureCookies: env.NODE_ENV === "production",
    storage:
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? createSupabaseStorage({ url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY })
        : undefined,
    botUsername: env.TELEGRAM_BOT_USERNAME,
  });
}
