import {
  createSql,
  createTelegramSender,
  runNotifications,
  type NotificationsReport,
} from "@barbershop/notifications";

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Секрет ${name} не задан`);
  return value;
};

const sql = createSql(required("NOTIFICATIONS_DB_URL"));
const send = createTelegramSender(required("TELEGRAM_BOT_TOKEN"));
const cronSecret = required("NOTIFICATIONS_CRON_SECRET");
const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

/**
 * Одно соединение (max: 1) не выдерживает параллельные транзакции postgres.js — второй вызов в том же
 * инстансе пропускаем. Между инстансами дубли исключает FOR UPDATE SKIP LOCKED.
 */
let running: Promise<NotificationsReport> | null = null;

const encoder = new TextEncoder();
const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

/** Сравнение хэшей одинаковой длины за постоянное время. */
async function isAuthorized(header: string | null): Promise<boolean> {
  if (!header) return false;
  const [actual, expected] = await Promise.all([digest(header), digest(cronSecret)]);
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= actual[index] ^ expected[index];
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!(await isAuthorized(request.headers.get("x-cron-secret")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (running) return Response.json({ skipped: "already running" }, { status: 409 });

  running = runNotifications({
    sql,
    send,
    appUrl,
    log: (message, data) => console.warn(message, JSON.stringify(data)),
  });
  try {
    const report = await running;
    console.log("notifications", JSON.stringify(report));
    return Response.json(report);
  } catch (error) {
    console.error("notifications: ошибка", error);
    return Response.json({ error: "failed" }, { status: 500 });
  } finally {
    running = null;
  }
});
