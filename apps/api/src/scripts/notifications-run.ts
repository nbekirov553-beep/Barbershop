import { createSql, createTelegramSender, runNotifications } from "@barbershop/notifications";
import { env } from "../env";

/** Один прогон той же логики, что и в Edge Function, — для разработки без деплоя. */
if (!env.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN не задан");
  process.exit(1);
}

const sql = createSql(env.NOTIFICATIONS_DB_URL ?? env.DATABASE_URL);
try {
  const report = await runNotifications({
    sql,
    send: createTelegramSender(env.TELEGRAM_BOT_TOKEN),
    appUrl: env.APP_URL.replace(/\/$/, ""),
    log: (message, data) => console.warn(message, data),
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end();
}
