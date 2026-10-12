import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

export type TelegramUser = {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
};

export class InitDataError extends Error {
  constructor(public reason: "MISSING_HASH" | "BAD_SIGNATURE" | "EXPIRED" | "NO_USER") {
    super(reason);
  }
}

export function parseJson(value: string | null): unknown {
  try {
    return JSON.parse(value ?? "null");
  } catch {
    return null;
  }
}

const sign = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

/** https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
export function validateInitData(
  raw: string,
  botToken: string,
  { maxAgeSec, now = Date.now() }: { maxAgeSec: number; now?: number },
): TelegramUser {
  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) throw new InitDataError("MISSING_HASH");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = sign("WebAppData", botToken);
  const expected = sign(secret, dataCheckString);
  const received = Buffer.from(hash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new InitDataError("BAD_SIGNATURE");
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec) {
    throw new InitDataError("EXPIRED");
  }

  const user = telegramUserSchema.safeParse(parseJson(params.get("user")));
  if (!user.success) throw new InitDataError("NO_USER");

  return {
    id: user.data.id,
    firstName: user.data.first_name,
    lastName: user.data.last_name,
    username: user.data.username,
  };
}

/** Подписывает initData так же, как Telegram. Нужен для тестов. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const hash = sign(sign("WebAppData", botToken), dataCheckString).toString("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
