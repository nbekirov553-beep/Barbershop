import type { PrismaClient } from "@barbershop/db";
import { REVIEW_COMMENT_PROMPT } from "@barbershop/notifications";
import type { FastifyBaseLogger } from "fastify";
import { Bot, InlineKeyboard, type Context } from "grammy";
import { loadSettings } from "../domain/settings.js";
import { AppError } from "../errors.js";
import { cancelBooking } from "../services/bookings.js";
import { BARBER_LINK_PREFIX, consumeBarberLinkCode } from "./link-codes.js";
import { barberMessages, clientMessages, contactsText, startText } from "./messages.js";
import type { Notifier } from "./notifier.js";
import {
  CANCEL_ABORT,
  CANCEL_ASK,
  CANCEL_CONFIRM,
  RATE,
  bookingKeyboard,
  bookingMessageInclude,
  findBookingForMessage,
  mainMenu,
  type BookingForMessage,
  type TelegramLinks,
} from "./shared.js";

const BOOKING_LINK_PREFIX = "b_";
const MY_BOOKINGS_LIMIT = 5;
const REVIEW_COMMENT_MAX_LENGTH = 1000;
const REVIEW_COMMENT_WINDOW_MS = 24 * 60 * 60_000;

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

type BotDeps = {
  prisma: PrismaClient;
  links: TelegramLinks;
  notifier: Notifier;
  log: FastifyBaseLogger;
};

export const botCommands = [
  { command: "start", description: "Главное меню" },
  { command: "my", description: "Мои записи" },
  { command: "contacts", description: "Адрес и часы работы" },
];

const isOwner = (booking: BookingForMessage, userId: number) =>
  booking.client.telegramId === BigInt(userId);

/** deps.notifier читается в момент вызова: notifier создаётся после бота и использует его api. */
export function createBot(token: string, deps: BotDeps): Bot {
  const { prisma, links, log } = deps;
  const bot = new Bot(token);
  const html = { parse_mode: "HTML" } as const;

  const timezone = async () => (await loadSettings(prisma)).timezone;

  /** Telegram-аккаунт уже знаком (записывался из Mini App) — запоминаем чат для уведомлений. */
  const rememberChat = async (ctx: Context) => {
    if (!ctx.from || ctx.chat?.type !== "private") return;
    await prisma.client.updateMany({
      where: { telegramId: BigInt(ctx.from.id) },
      data: { telegramChatId: BigInt(ctx.chat.id) },
    });
  };

  /** b_<token>: связывает запись с сайта с Telegram-аккаунтом. */
  const linkBooking = async (ctx: Context, token: string) => {
    const booking = await findBookingForMessage(prisma, token);
    if (!booking || !ctx.from || !ctx.chat) {
      await ctx.reply("Запись не найдена. Проверьте ссылку или запишитесь заново.", { reply_markup: mainMenu(links) });
      return;
    }

    const telegramId = BigInt(ctx.from.id);
    const owner = booking.client.telegramId;
    if (owner !== null && owner !== telegramId) {
      await ctx.reply("Эта запись уже привязана к другому Telegram-аккаунту.");
      return;
    }

    if (owner === null) {
      const other = await prisma.client.findUnique({ where: { telegramId }, select: { id: true } });
      if (other && other.id !== booking.client.id) {
        // Telegram уже привязан к другому клиенту: чат запоминаем, telegram_id не трогаем (он уникален).
        await prisma.client.update({ where: { id: booking.client.id }, data: { telegramChatId: BigInt(ctx.chat.id) } });
      } else {
        await prisma.client.update({
          where: { id: booking.client.id },
          data: { telegramId, telegramChatId: BigInt(ctx.chat.id) },
        });
      }
    } else {
      await prisma.client.update({ where: { id: booking.client.id }, data: { telegramChatId: BigInt(ctx.chat.id) } });
    }

    const isActive = booking.status === "confirmed" && booking.startsAt > new Date();
    await ctx.reply(clientMessages.linked(booking, await timezone(), isActive), {
      ...html,
      reply_markup: bookingKeyboard(token, links, isActive),
    });
  };

  const linkBarber = async (ctx: Context, code: string) => {
    if (!ctx.chat || ctx.chat.type !== "private") return;
    const result = await consumeBarberLinkCode(prisma, code, ctx.chat.id);
    await ctx.reply(
      result.ok
        ? barberMessages.linked(result.barberName)
        : "Ссылка недействительна: её уже использовали или срок истёк. Попросите администратора новую.",
      html,
    );
  };

  const sendMyBookings = async (ctx: Context) => {
    if (!ctx.from) return;
    const bookings = await prisma.booking.findMany({
      where: { client: { telegramId: BigInt(ctx.from.id) }, status: "confirmed", endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      take: MY_BOOKINGS_LIMIT,
      include: bookingMessageInclude,
    });

    if (bookings.length === 0) {
      await ctx.reply("Активных записей нет.", { reply_markup: mainMenu(links) });
      return;
    }
    const tz = await timezone();
    for (const booking of bookings) {
      await ctx.reply(clientMessages.linked(booking, tz, true), {
        ...html,
        reply_markup: bookingKeyboard(booking.manageToken, links, true),
      });
    }
  };

  bot.command("start", async (ctx) => {
    await rememberChat(ctx);
    const payload = ctx.match.trim();
    if (payload.startsWith(BOOKING_LINK_PREFIX)) return linkBooking(ctx, payload.slice(BOOKING_LINK_PREFIX.length));
    if (payload.startsWith(BARBER_LINK_PREFIX)) return linkBarber(ctx, payload.slice(BARBER_LINK_PREFIX.length));
    await ctx.reply(startText(ctx.from?.first_name ?? ""), { ...html, reply_markup: mainMenu(links) });
  });

  bot.command("my", async (ctx) => {
    await rememberChat(ctx);
    await sendMyBookings(ctx);
  });

  bot.command("contacts", (ctx) => ctx.reply(contactsText(), html));

  bot.callbackQuery("my", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendMyBookings(ctx);
  });

  bot.callbackQuery("contacts", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(contactsText(), html);
  });

  bot.callbackQuery(new RegExp(`^(${CANCEL_ASK}|${CANCEL_CONFIRM}|${CANCEL_ABORT}):(.+)$`), async (ctx) => {
    const [, action, token] = ctx.match;
    const booking = await findBookingForMessage(prisma, token);
    if (!booking || !isOwner(booking, ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Запись не найдена", show_alert: true });
      return;
    }

    if (action === CANCEL_ASK) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({
        reply_markup: new InlineKeyboard()
          .text("Да, отменить", `${CANCEL_CONFIRM}:${token}`)
          .text("Оставить", `${CANCEL_ABORT}:${token}`),
      });
      return;
    }

    if (action === CANCEL_ABORT) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: bookingKeyboard(token, links, true) });
      return;
    }

    try {
      await cancelBooking(prisma, token);
    } catch (error) {
      const message = error instanceof AppError ? error.message : "Не получилось отменить, попробуйте позже";
      await ctx.answerCallbackQuery({ text: message, show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: "Запись отменена" });
    await ctx.editMessageText(clientMessages.cancelled(booking, await timezone()), html);
    deps.notifier.bookingCancelled(token, { skipClient: true });
  });

  /** r:<token>:<1-5> — оценка из запроса отзыва, который шлёт Edge Function notifications. */
  bot.callbackQuery(new RegExp(`^${RATE}:(.+):([1-5])$`), async (ctx) => {
    const [, token, value] = ctx.match;
    const rating = Number(value);
    const booking = await findBookingForMessage(prisma, token);
    if (!booking || !isOwner(booking, ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Запись не найдена", show_alert: true });
      return;
    }
    if (booking.status !== "completed") {
      await ctx.answerCallbackQuery({ text: "Оценить можно только состоявшийся визит", show_alert: true });
      return;
    }

    const settings = await loadSettings(prisma);
    try {
      await prisma.review.create({
        data: {
          bookingId: booking.id,
          barberId: booking.barberId,
          clientId: booking.client.id,
          rating,
          isPublic: rating >= settings.reviewPublicMinRating,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      await ctx.answerCallbackQuery({ text: "Вы уже оценили этот визит" });
      await ctx.editMessageReplyMarkup();
      return;
    }

    await ctx.answerCallbackQuery({ text: "Спасибо!" });
    await ctx.editMessageText(clientMessages.rated(booking.barber.name, rating), html);
    await ctx.reply(REVIEW_COMMENT_PROMPT, {
      reply_markup: { force_reply: true, input_field_placeholder: "Комментарий к визиту" },
    });
  });

  /** Ответ на REVIEW_COMMENT_PROMPT — комментарий к последней оценке клиента без комментария. */
  bot.on("message:text", async (ctx, next) => {
    const prompt = ctx.message.reply_to_message;
    if (!prompt?.from?.is_bot || prompt.text !== REVIEW_COMMENT_PROMPT) return next();

    const review = await prisma.review.findFirst({
      where: {
        client: { telegramId: BigInt(ctx.from.id) },
        comment: null,
        createdAt: { gt: new Date(Date.now() - REVIEW_COMMENT_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!review) {
      await ctx.reply("Не нашли оценку, к которой можно добавить комментарий.");
      return;
    }

    await prisma.review.update({
      where: { id: review.id },
      data: { comment: ctx.message.text.trim().slice(0, REVIEW_COMMENT_MAX_LENGTH) },
    });
    await ctx.reply("Спасибо, передадим мастеру.");
  });

  bot.catch(({ error, ctx }) => {
    log.error({ err: error, updateId: ctx.update.update_id }, "Telegram: ошибка обработки апдейта");
  });

  return bot;
}

/** Команды и кнопка меню бота; вызывается при старте API. */
export async function configureBotMenu(bot: Bot, links: TelegramLinks) {
  await bot.api.setMyCommands(botCommands);
  await bot.api.setChatMenuButton({
    menu_button: links.miniAppUrl
      ? { type: "web_app", text: "Записаться", web_app: { url: links.miniAppUrl } }
      : { type: "commands" },
  });
}
