import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env";
import { supabaseProjectRef } from "./env-file";

/**
 * Деплой Edge Function notifications и её секретов. Нужен вход: npx supabase login
 * (или SUPABASE_ACCESS_TOKEN). Секреты передаются через временный файл и не печатаются.
 */
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const projectRef = supabaseProjectRef(env.SUPABASE_URL);

const secrets = {
  TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
  NOTIFICATIONS_DB_URL: env.NOTIFICATIONS_DB_URL,
  NOTIFICATIONS_CRON_SECRET: env.NOTIFICATIONS_CRON_SECRET,
  APP_URL: env.APP_URL.replace(/\/$/, ""),
};
const missing = Object.entries(secrets).filter(([, value]) => !value).map(([key]) => key);
if (missing.length > 0) {
  console.error(`Не заданы: ${missing.join(", ")}. Для БД и секрета cron: npm run notifications:role`);
  process.exit(1);
}

const supabase = (args: string[]) => {
  const result = spawnSync("npx", ["supabase", ...args, "--project-ref", projectRef], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const dir = await mkdtemp(path.join(tmpdir(), "notifications-"));
const envFile = path.join(dir, ".env");
try {
  await writeFile(envFile, Object.entries(secrets).map(([key, value]) => `${key}=${value}`).join("\n"));
  supabase(["secrets", "set", "--env-file", envFile]);
} finally {
  await rm(dir, { recursive: true, force: true });
}

supabase(["functions", "deploy", "notifications", "--use-api", "--no-verify-jwt"]);
console.log("Готово. Расписание: npm run notifications:cron");
