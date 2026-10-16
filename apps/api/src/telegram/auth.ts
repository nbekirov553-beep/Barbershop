import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../errors.js";
import { InitDataError, parseJson, validateInitData, type TelegramUser } from "./init-data.js";

export type TelegramAuthOptions = {
  botToken?: string;
  maxAgeSec: number;
  /** Разрешает `Authorization: tma-dev <json>` для разработки в обычном браузере. */
  allowDevAuth: boolean;
};

const devUserSchema = z.object({
  id: z.number().int().positive(),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  username: z.string().optional(),
});

const unauthorized = (message: string) => new AppError(401, "TELEGRAM_AUTH_FAILED", message);

const messages: Record<InitDataError["reason"], string> = {
  MISSING_HASH: "Нет подписи Telegram",
  BAD_SIGNATURE: "Подпись Telegram не прошла проверку",
  EXPIRED: "Сессия Telegram устарела, откройте приложение заново",
  NO_USER: "Telegram не передал пользователя",
};

/** null — заголовка нет (обычный посетитель сайта); ошибка — заголовок есть, но он невалиден. */
export function getTelegramUser(request: FastifyRequest, options: TelegramAuthOptions): TelegramUser | null {
  const header = request.headers.authorization;
  if (!header) return null;

  const [scheme, ...rest] = header.split(" ");
  const payload = rest.join(" ");

  if (scheme === "tma-dev") {
    if (!options.allowDevAuth) throw unauthorized("Dev-авторизация выключена");
    const parsed = devUserSchema.safeParse(parseJson(payload));
    if (!parsed.success) throw unauthorized("Некорректный dev-пользователь");
    return parsed.data;
  }

  if (scheme !== "tma") return null;
  if (!options.botToken) throw unauthorized("На сервере не задан TELEGRAM_BOT_TOKEN");

  try {
    return validateInitData(payload, options.botToken, { maxAgeSec: options.maxAgeSec });
  } catch (error) {
    if (error instanceof InitDataError) throw unauthorized(messages[error.reason]);
    throw unauthorized("Некорректные данные Telegram");
  }
}

export function requireTelegramUser(request: FastifyRequest, options: TelegramAuthOptions): TelegramUser {
  const user = getTelegramUser(request, options);
  if (!user) throw unauthorized("Откройте приложение через Telegram");
  return user;
}
