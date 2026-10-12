import { createSql } from "@barbershop/notifications";
import { env } from "../env";
import { supabaseProjectRef } from "./env-file";

/**
 * Supabase Cron: каждые 5 минут pg_net вызывает Edge Function notifications.
 * Секрет хранится в Supabase Vault, а не в тексте cron-задачи.
 *   npm run notifications:cron            — создать/обновить задачу
 *   npm run notifications:cron -- --delete — удалить задачу
 */
const JOB_NAME = "notifications";
const SCHEDULE = "*/5 * * * *";
const VAULT_SECRET = "notifications_cron_secret";

const projectRef = supabaseProjectRef(env.SUPABASE_URL);
const sql = createSql(env.DATABASE_URL);

try {
  if (process.argv.includes("--delete")) {
    await sql`select cron.unschedule(jobid) from cron.job where jobname = ${JOB_NAME}`;
    console.log(`Cron-задача ${JOB_NAME} удалена`);
  } else {
    if (!env.NOTIFICATIONS_CRON_SECRET) {
      console.error("NOTIFICATIONS_CRON_SECRET не задан: сначала npm run notifications:role");
      process.exit(1);
    }

    await sql`create extension if not exists pg_cron with schema pg_catalog`;
    await sql`create extension if not exists pg_net with schema extensions`;

    const [existing] = await sql<{ id: string }[]>`select id from vault.secrets where name = ${VAULT_SECRET}`;
    if (existing) await sql`select vault.update_secret(${existing.id}::uuid, ${env.NOTIFICATIONS_CRON_SECRET})`;
    else await sql`select vault.create_secret(${env.NOTIFICATIONS_CRON_SECRET}, ${VAULT_SECRET})`;

    const functionUrl = `https://${projectRef}.supabase.co/functions/v1/notifications`;
    const command = `
      select net.http_post(
        url := '${functionUrl}',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = '${VAULT_SECRET}')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    `;
    await sql`select cron.schedule(${JOB_NAME}, ${SCHEDULE}, ${command})`;
    console.log(`Cron-задача ${JOB_NAME} (${SCHEDULE}) → ${functionUrl}`);
  }
} finally {
  await sql.end();
}
