import { formatDateLong } from "@barbershop/shared/format";
import { shop } from "@barbershop/shared/shop";
import { toZoned } from "@barbershop/shared/time";

/** callback_data кнопок бота: формат `<prefix>:<manageToken>[:<value>]`, лимит Telegram — 64 байта. */
export const CALLBACK = {
  cancelAsk: "c",
  cancelConfirm: "cy",
  cancelAbort: "cn",
  rate: "r",
} as const;

export const REVIEW_COMMENT_PROMPT = "Если хотите, напишите пару слов о визите ответом на это сообщение.";

type InlineButton = { text: string; callback_data: string } | { text: string; url: string };
export type InlineKeyboardMarkup = { inline_keyboard: InlineButton[][] };

export type ReminderBooking = {
  manageToken: string;
  startsAt: Date;
  endsAt: Date;
  barberName: string;
  services: string;
};

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function formatSlot(startsAt: Date, endsAt: Date, timezone: string): string {
  const start = toZoned(startsAt, timezone);
  const end = toZoned(endsAt, timezone);
  return `${formatDateLong(start.date)}, ${start.time}–${end.time}`;
}

export const shopAddress = `${shop.address}. ${shop.landmark}.`;

export const ratingStars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);

export const reminderMessages = {
  day: (booking: ReminderBooking, timezone: string) =>
    [
      "<b>Напоминаем о записи</b>",
      "",
      `<b>${formatSlot(booking.startsAt, booking.endsAt, timezone)}</b>`,
      `Мастер: ${escapeHtml(booking.barberName)}`,
      `Услуги: ${escapeHtml(booking.services)}`,
      "",
      shopAddress,
      "Если планы изменились, отмените запись заранее.",
    ].join("\n"),

  short: (booking: ReminderBooking, timezone: string) =>
    [
      "<b>Скоро ваш визит</b>",
      "",
      `Ждём вас в <b>${toZoned(booking.startsAt, timezone).time}</b>, мастер ${escapeHtml(booking.barberName)}.`,
      shopAddress,
    ].join("\n"),

  review: (booking: ReminderBooking, timezone: string) =>
    [
      "<b>Как прошёл визит?</b>",
      "",
      `${formatDateLong(toZoned(booking.startsAt, timezone).date)}, мастер ${escapeHtml(booking.barberName)}.`,
      "Оцените, пожалуйста, от 1 до 5.",
    ].join("\n"),
};

const isPublicUrl = (url: string) => url.startsWith("https://");

export function reminderKeyboard(token: string, appUrl: string): InlineKeyboardMarkup {
  const row: InlineButton[] = [{ text: "Отменить запись", callback_data: `${CALLBACK.cancelAsk}:${token}` }];
  if (isPublicUrl(appUrl)) row.push({ text: "Перенести", url: `${appUrl}/booking/${token}` });
  return { inline_keyboard: [row] };
}

export function ratingKeyboard(token: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [1, 2, 3, 4, 5].map((rating) => ({
        text: `${rating} ★`,
        callback_data: `${CALLBACK.rate}:${token}:${rating}`,
      })),
    ],
  };
}
