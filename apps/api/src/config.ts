import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => value || undefined);
const optionalHttpsUrl = optionalString.pipe(
  z.url({ protocol: /^https$/, error: "Нужен HTTPS-адрес" }).optional(),
);

const envSchema = z
  .object({
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
    /** Vercel выставляет VERCEL=1 во всех своих окружениях. */
    VERCEL: optionalString,
  })
  .superRefine((value, ctx) => {
    const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (value.TELEGRAM_DEV_AUTH && value.NODE_ENV === "production") {
      fail("TELEGRAM_DEV_AUTH", "TELEGRAM_DEV_AUTH нельзя включать в production");
    }
    if (value.TELEGRAM_BOT_MODE !== "off" && !value.TELEGRAM_BOT_TOKEN) {
      fail("TELEGRAM_BOT_MODE", "TELEGRAM_BOT_MODE требует TELEGRAM_BOT_TOKEN");
    }
    if (value.TELEGRAM_BOT_MODE === "webhook" && !value.TELEGRAM_WEBHOOK_SECRET) {
      fail("TELEGRAM_WEBHOOK_SECRET", "Режим webhook требует TELEGRAM_WEBHOOK_SECRET");
    }
    if (value.TELEGRAM_BOT_MODE === "polling" && value.VERCEL) {
      fail("TELEGRAM_BOT_MODE", "На Vercel бот работает только через webhook: long polling в serverless невозможен");
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Разбор переменных окружения без побочных эффектов: решение, что делать с ошибкой, за вызывающим. */
export function parseEnv(source: NodeJS.ProcessEnv) {
  const parsed = envSchema.safeParse(source);
  return parsed.success
    ? ({ ok: true, env: parsed.data } as const)
    : ({ ok: false, errors: z.flattenError(parsed.error).fieldErrors } as const);
}

export const appLinks = (env: Env) => ({ appUrl: env.APP_URL.replace(/\/$/, ""), miniAppUrl: env.MINIAPP_URL });
