import { createPrismaClient } from "@barbershop/db";
import Fastify from "fastify";
import { appLinks, parseEnv } from "./config.js";
import { registerApi } from "./register-api.js";
import { healthRoutes } from "./routes/health.js";
import { createSupabaseStorage } from "./storage.js";
import { configureBotMenu } from "./telegram/bot.js";

// Переменные окружения: на Vercel — Environment Variables проекта, локально — корневой .env через --env-file-if-exists.
const app = Fastify({ logger: true });

// /health регистрируется первым и ни от чего не зависит: отвечает, даже если env неполный или база недоступна.
await app.register(healthRoutes);

const parsed = parseEnv(process.env);

if (parsed.ok) {
  const env = parsed.env;
  const links = appLinks(env);
  await registerApi(app, {
    prisma: createPrismaClient(env.DATABASE_URL),
    corsOrigins: env.CORS_ORIGINS,
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN,
      maxAgeSec: env.TELEGRAM_INIT_DATA_TTL_SEC,
      allowDevAuth: env.TELEGRAM_DEV_AUTH,
    },
    bot: env.TELEGRAM_BOT_TOKEN
      ? { token: env.TELEGRAM_BOT_TOKEN, mode: env.TELEGRAM_BOT_MODE, webhookSecret: env.TELEGRAM_WEBHOOK_SECRET, links }
      : undefined,
    secureCookies: env.NODE_ENV === "production",
    storage:
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? createSupabaseStorage({ url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY })
        : undefined,
    botUsername: env.TELEGRAM_BOT_USERNAME,
  });

  // Long polling — только локальная разработка. На Vercel бот получает апдейты через webhook (TELEGRAM_BOT_MODE=webhook).
  const bot = app.bot;
  if (bot && env.TELEGRAM_BOT_MODE === "polling" && !env.VERCEL) {
    app.addHook("onReady", async () => {
      try {
        await bot.init();
        await configureBotMenu(bot, links);
        void bot.start({ drop_pending_updates: true }).catch((error: unknown) => {
          app.log.error({ err: error }, "Telegram: polling остановлен");
        });
        app.log.info(`Telegram: @${bot.botInfo.username}, long polling`);
      } catch (error) {
        app.log.error({ err: error }, "Telegram: не удалось запустить polling");
      }
    });
    app.addHook("onClose", async () => {
      if (bot.isRunning()) await bot.stop();
    });
  }
} else {
  app.log.error({ errors: parsed.errors }, "Некорректные переменные окружения: API выключен, работает только /health");
}

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Без await: на Vercel listen() перехватывается рантаймом, ожидание блокировало бы загрузку модуля.
app.listen({ port: Number(process.env.PORT) || 4100, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error({ err: error }, "Не удалось запустить сервер");
  process.exit(1);
});
