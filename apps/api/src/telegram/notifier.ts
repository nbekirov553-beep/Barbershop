import type { PrismaClient } from "@barbershop/db";
import type { FastifyBaseLogger } from "fastify";
import { GrammyError, type Api } from "grammy";
import { loadSettings } from "../domain/settings.js";
import { barberMessages, clientMessages } from "./messages.js";
import {
  bookingKeyboard,
  clientChatId,
  findBookingForMessage,
  type BookingForMessage,
  type TelegramLinks,
} from "./shared.js";

type Previous = { startsAt: Date; endsAt: Date };
/** skipClient: клиент уже видит результат в боте (например, отменил кнопкой). */
type NotifyOptions = { skipClient?: boolean };

export type Notifier = {
  bookingCreated: (token: string, options?: NotifyOptions) => void;
  bookingCancelled: (token: string, options?: NotifyOptions) => void;
  bookingRescheduled: (token: string, previous: Previous, options?: NotifyOptions) => void;
};

export const silentNotifier: Notifier = {
  bookingCreated: () => {},
  bookingCancelled: () => {},
  bookingRescheduled: () => {},
};

type Event =
  | { type: "created" }
  | { type: "cancelled" }
  | { type: "rescheduled"; previous: Previous };

/**
 * Уведомления отправляются после ответа API: ошибка Telegram (бот заблокирован, чат не начат)
 * не должна ломать запись, поэтому всё ловится и логируется.
 */
export function createNotifier(options: {
  api: Api;
  prisma: PrismaClient;
  links: TelegramLinks;
  log: FastifyBaseLogger;
}): Notifier {
  const { api, prisma, links, log } = options;

  const send = async (chatId: bigint | null, text: string, keyboard?: ReturnType<typeof bookingKeyboard>) => {
    if (chatId === null) return;
    try {
      await api.sendMessage(chatId.toString(), text, { parse_mode: "HTML", reply_markup: keyboard });
    } catch (error) {
      const isUserSide = error instanceof GrammyError && (error.error_code === 403 || error.error_code === 400);
      log[isUserSide ? "info" : "error"]({ err: error, chatId: chatId.toString() }, "Telegram: сообщение не доставлено");
    }
  };

  const handle = async (token: string, event: Event, options: NotifyOptions = {}) => {
    const [booking, settings] = await Promise.all([findBookingForMessage(prisma, token), loadSettings(prisma)]);
    if (!booking) return;
    const tz = settings.timezone;
    const isActive = booking.status === "confirmed";
    const keyboard = bookingKeyboard(token, links, isActive);

    const forClient = (b: BookingForMessage) =>
      event.type === "created"
        ? clientMessages.created(b, tz)
        : event.type === "cancelled"
          ? clientMessages.cancelled(b, tz)
          : clientMessages.rescheduled(b, event.previous, tz);

    const forBarber = (b: BookingForMessage) =>
      event.type === "created"
        ? barberMessages.created(b, tz)
        : event.type === "cancelled"
          ? barberMessages.cancelled(b, tz)
          : barberMessages.rescheduled(b, event.previous, tz);

    await Promise.all([
      options.skipClient
        ? Promise.resolve()
        : send(clientChatId(booking), forClient(booking), event.type === "cancelled" ? undefined : keyboard),
      send(booking.barber.telegramChatId, forBarber(booking)),
    ]);
  };

  const dispatch = (token: string, event: Event, options?: NotifyOptions) => {
    handle(token, event, options).catch((error: unknown) =>
      log.error({ err: error }, "Telegram: ошибка уведомления"),
    );
  };

  return {
    bookingCreated: (token, options) => dispatch(token, { type: "created" }, options),
    bookingCancelled: (token, options) => dispatch(token, { type: "cancelled" }, options),
    bookingRescheduled: (token, previous, options) =>
      dispatch(token, { type: "rescheduled", previous }, options),
  };
}
