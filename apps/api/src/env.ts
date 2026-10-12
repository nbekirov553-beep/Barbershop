import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const optionalString = z
  .string()
  .optional()
  .transform((value) => value || undefined);
const optionalHttpsUrl = optionalString.pipe(
  z.url({ protocol: /^https$/, error: "Нужен HTTPS-адрес" }).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4100),
  DATABASE_URL: z.string().min(1, "DATABASE_URL обязателен"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001,http://localhost:5173")
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)),
  APP_URL: z.url().default("http://localhost:3000"),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_BOT_USERNAME: optionalString,
  TELEGRAM_BOT_MODE: z.enum(["off", "polling", "webhook"]).default("off"),
  TELEGRAM_WEBHOOK_SECRET: optionalString,
  PUBLIC_API_URL: optionalHttpsUrl,
  MINIAPP_URL: optionalHttpsUrl,
  TELEGRAM_INIT_DATA_TTL_SEC: z.coerce.number().int().positive().default(86_400),
  TELEGRAM_DEV_AUTH: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SUPABASE_URL: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  NOTIFICATIONS_DB_URL: optionalString,
  NOTIFICATIONS_CRON_SECRET: optionalString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Некорректные переменные окружения:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

if (parsed.data.TELEGRAM_DEV_AUTH && parsed.data.NODE_ENV === "production") {
  console.error("TELEGRAM_DEV_AUTH нельзя включать в production");
  process.exit(1);
}

if (parsed.data.TELEGRAM_BOT_MODE !== "off" && !parsed.data.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_MODE требует TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

if (parsed.data.TELEGRAM_BOT_MODE === "webhook" && !parsed.data.TELEGRAM_WEBHOOK_SECRET) {
  console.error("Режим webhook требует TELEGRAM_WEBHOOK_SECRET");
  process.exit(1);
}

export const env = parsed.data;
