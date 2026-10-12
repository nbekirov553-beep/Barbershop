import type { PrismaClient } from "@barbershop/db";
import { CALLBACK } from "@barbershop/notifications";
import { InlineKeyboard } from "grammy";

export type TelegramLinks = {
  /** Сайт: ссылки на /booking/<token>. Telegram принимает в кнопках только публичные адреса. */
  appUrl: string;
  /** HTTPS-адрес Mini App для кнопок web_app. */
  miniAppUrl?: string;
};

export const CANCEL_ASK = CALLBACK.cancelAsk;
export const CANCEL_CONFIRM = CALLBACK.cancelConfirm;
export const CANCEL_ABORT = CALLBACK.cancelAbort;
export const RATE = CALLBACK.rate;

export const bookingMessageInclude = {
  barber: { select: { name: true, telegramChatId: true } },
  client: { select: { id: true, name: true, phone: true, telegramId: true, telegramChatId: true } },
  services: { select: { name: true } },
} as const;

export function findBookingForMessage(prisma: PrismaClient, token: string) {
  return prisma.booking.findUnique({ where: { manageToken: token }, include: bookingMessageInclude });
}

export type BookingForMessage = NonNullable<Awaited<ReturnType<typeof findBookingForMessage>>>;

const isPublicUrl = (url: string) => url.startsWith("https://");

/** Чат клиента: явная привязка через /start или telegram_id из Mini App (для личных чатов id совпадают). */
export function clientChatId(booking: BookingForMessage): bigint | null {
  return booking.client.telegramChatId ?? booking.client.telegramId;
}

export function bookingKeyboard(token: string, links: TelegramLinks, canManage: boolean): InlineKeyboard | undefined {
  const keyboard = new InlineKeyboard();
  if (canManage) keyboard.text("Отменить запись", `${CANCEL_ASK}:${token}`);
  if (isPublicUrl(links.appUrl)) keyboard.url("Перенести или посмотреть", `${links.appUrl}/booking/${token}`);
  return keyboard.inline_keyboard.flat().length > 0 ? keyboard : undefined;
}

export function mainMenu(links: TelegramLinks): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (links.miniAppUrl) keyboard.webApp("Записаться", links.miniAppUrl).row();
  else if (isPublicUrl(links.appUrl)) keyboard.url("Записаться на сайте", `${links.appUrl}/book`).row();
  return keyboard.text("Мои записи", "my").text("Контакты", "contacts");
}
