import { createServerApp, links } from "./create";
import { env } from "./env";
import { configureBotMenu } from "./telegram/bot";

const app = await createServerApp();
const bot = app.bot;

const shutdown = async () => {
  if (bot?.isRunning()) await bot.stop();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

if (bot) {
  try {
    await bot.init();
    await configureBotMenu(bot, links);
    app.log.info(`Telegram: @${bot.botInfo.username}, режим ${env.TELEGRAM_BOT_MODE}`);
  } catch (error) {
    app.log.error({ err: error }, "Telegram: не удалось инициализировать бота");
  }

  if (env.TELEGRAM_BOT_MODE === "polling" && bot.isInited()) {
    // Long polling только для разработки: снимает webhook, если он был задан.
    void bot.start({ drop_pending_updates: true }).catch((error: unknown) => {
      app.log.error({ err: error }, "Telegram: polling остановлен");
    });
  }
}
