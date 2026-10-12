import { randomBytes } from "node:crypto";
import { createSql } from "@barbershop/notifications";
import { env } from "../env";
import { supabaseProjectRef, upsertEnv } from "./env-file";

/**
 * Задаёт пароль роли notifications_worker и пишет в .env:
 * NOTIFICATIONS_DB_URL — подключение Edge Function с ограниченными правами,
 * NOTIFICATIONS_CRON_SECRET — секрет заголовка x-cron-secret (если его ещё нет).
 */
const ROLE = "notifications_worker";
const projectRef = supabaseProjectRef(env.SUPABASE_URL);

const password = randomBytes(24).toString("hex");
const admin = createSql(env.DATABASE_URL);
// hex-пароль безопасен для SQL-литерала; ALTER ROLE не принимает параметры.
await admin.unsafe(`alter role ${ROLE} with password '${password}'`);
await admin.end();

const workerUrl = new URL(env.DATABASE_URL);
workerUrl.username = `${ROLE}.${projectRef}`;
workerUrl.password = password;
workerUrl.searchParams.delete("pgbouncer");

const worker = createSql(workerUrl.toString());
try {
  const [{ count }] = await worker<{ count: string }[]>`select count(*)::text as count from bookings`;
  const adminAccess = await worker`select 1 from admin_users limit 1`.then(
    () => "есть (ошибка!)",
    () => "нет",
  );
  console.log(`Роль ${ROLE}: подключение OK, записей видно: ${count}, доступ к admin_users: ${adminAccess}`);
} finally {
  await worker.end();
}

await upsertEnv({
  NOTIFICATIONS_DB_URL: workerUrl.toString(),
  ...(env.NOTIFICATIONS_CRON_SECRET ? {} : { NOTIFICATIONS_CRON_SECRET: randomBytes(32).toString("hex") }),
});
console.log("NOTIFICATIONS_DB_URL и NOTIFICATIONS_CRON_SECRET записаны в .env");
