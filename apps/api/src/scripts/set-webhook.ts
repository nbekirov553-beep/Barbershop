/**
 * Production-настройка бота: webhook, команды и кнопка меню Mini App. npm run bot:webhook
 * npm run bot:webhook -- --delete   снимает webhook (например, чтобы вернуться к polling).
 * На Vercel server.ts не запускается, поэтому меню бота задаётся здесь.
 */
import { Bot } from "grammy";
import { TELEGRAM_WEBHOOK_PATH } from "../app";
import { links } from "../create";
import { env } from "../env";
import { configureBotMenu } from "../telegram/bot";

if (!env.TELEGRAM_BOT_TOKEN) {
  console.error("Задайте TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

if (process.argv.includes("--delete")) {
  await bot.api.deleteWebhook();
  console.log("Webhook снят");
} else {
  if (!env.PUBLIC_API_URL || !env.TELEGRAM_WEBHOOK_SECRET) {
    console.error("Задайте PUBLIC_API_URL (https) и TELEGRAM_WEBHOOK_SECRET");
    process.exit(1);
  }
  const url = `${env.PUBLIC_API_URL.replace(/\/$/, "")}${TELEGRAM_WEBHOOK_PATH}`;
  await bot.api.setWebhook(url, {
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await configureBotMenu(bot, links);
  console.log(`Webhook: ${url}`);
  console.log(`Кнопка меню: ${links.miniAppUrl ?? "команды (MINIAPP_URL не задан)"}`);
}

const { url, pending_update_count, last_error_message } = await bot.api.getWebhookInfo();
console.log({ url, pending_update_count, last_error_message });
