import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@barbershop/db";
import {
  REVIEW_COMMENT_PROMPT,
  createSql,
  runNotifications,
  type InlineKeyboardMarkup,
  type SendMessage,
  type Sql,
} from "@barbershop/notifications";
import { TELEGRAM_WEBHOOK_PATH, buildApp } from "../src/register-api.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
/** Джоба ходит в БД под ролью notifications_worker — заодно проверяем её права. */
const workerUrl = process.env.NOTIFICATIONS_DB_URL ?? databaseUrl;
const PHONE = "+998990000021";
const CLIENT_TG = 990_021;
const SECRET = "test-secret";
const MIN = 60_000;

type Sent = { chatId: string; text: string; keyboard?: InlineKeyboardMarkup };

describe.skipIf(!databaseUrl)("Edge Function notifications: напоминания, автозавершение, отзыв", () => {
  let prisma: PrismaClient;
  let sql: Sql;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let messages: Sent[] = [];
  let mode: "ok" | "retry" | "permanent" = "ok";
  const now = new Date(Math.floor(Date.now() / MIN) * MIN);
  const ids = {} as Record<"day" | "short" | "review" | "old" | "cancelled", { id: string; token: string }>;
  let updateId = 1;

  const send: SendMessage = async (chatId, text, keyboard) => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (mode !== "ok") return { ok: false, permanent: mode === "permanent", description: "test" };
    messages.push({ chatId, text, keyboard });
    return { ok: true };
  };
  const mine = () => messages.filter((message) => message.chatId === String(CLIENT_TG));
  const run = () => runNotifications({ sql, send, appUrl: "https://usto.example", now });
  const booking = (key: keyof typeof ids) => prisma.booking.findUniqueOrThrow({ where: { id: ids[key].id } });

  const cleanup = async () => {
    await prisma.booking.deleteMany({ where: { client: { phone: PHONE } } });
    await prisma.client.deleteMany({ where: { phone: PHONE } });
  };

  const post = (body: object) =>
    app.inject({
      method: "POST",
      url: TELEGRAM_WEBHOOK_PATH,
      headers: { "x-telegram-bot-api-secret-token": SECRET },
      payload: { update_id: updateId++, ...body },
    });

  const from = { id: CLIENT_TG, is_bot: false, first_name: "Test" };
  const chat = { id: CLIENT_TG, type: "private", first_name: "Test" };

  beforeAll(async () => {
    prisma = createPrismaClient(databaseUrl);
    sql = createSql(workerUrl!);
    app = await buildApp({
      prisma,
      corsOrigins: [],
      logger: false,
      bot: { token: "1:test", mode: "webhook", webhookSecret: SECRET, links: { appUrl: "http://localhost:3000" } },
    });
    app.bot!.api.config.use(async () => ({ ok: true, result: true }) as never);
    await cleanup();

    const [, , barber] = await prisma.barber.findMany({ orderBy: { sortOrder: "asc" } });
    const client = await prisma.client.create({
      data: { name: "Reminder Test", phone: PHONE, telegramId: BigInt(CLIENT_TG), telegramChatId: BigInt(CLIENT_TG) },
    });

    const create = async (key: keyof typeof ids, startOffsetMin: number, extra: object = {}) => {
      const startsAt = new Date(now.getTime() + startOffsetMin * MIN);
      const created = await prisma.booking.create({
        data: {
          clientId: client.id,
          barberId: barber.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 60 * MIN),
          totalPrice: 150_000,
          totalDurationMin: 60,
          manageToken: randomBytes(24).toString("base64url"),
          services: { create: [{ name: "Стрижка", durationMin: 60, price: 150_000 }] },
          ...extra,
        },
      });
      ids[key] = { id: created.id, token: created.manageToken };
    };

    await create("day", 20 * 60);
    await create("short", 20, { reminderDaySentAt: now });
    await create("review", -150);
    await create("old", -3 * 24 * 60);
    await create("cancelled", 22 * 60, { status: "cancelled" });
  });

  afterAll(async () => {
    if (!app) return;
    await cleanup();
    await sql.end();
    await app.close();
  });

  it("первый запуск: напоминания за день и за 30 минут, автозавершение, запрос отзыва", async () => {
    const report = await run();
    expect(report.autoCompleted).toBeGreaterThanOrEqual(2);

    const texts = mine().map((message) => message.text);
    expect(texts).toHaveLength(3);
    expect(texts.filter((text) => text.includes("Напоминаем о записи"))).toHaveLength(1);
    expect(texts.filter((text) => text.includes("Скоро ваш визит"))).toHaveLength(1);
    const review = mine().find((message) => message.text.includes("Как прошёл визит"));
    expect(review?.keyboard?.inline_keyboard[0]).toHaveLength(5);

    expect((await booking("day")).reminderDaySentAt).not.toBeNull();
    expect((await booking("short")).reminder30mSentAt).not.toBeNull();
    const reviewed = await booking("review");
    expect(reviewed.status).toBe("completed");
    expect(reviewed.autoCompletedAt).not.toBeNull();
    expect(reviewed.reviewRequestedAt).not.toBeNull();
    const old = await booking("old");
    expect(old.status).toBe("completed");
    expect(old.reviewRequestedAt).toBeNull();
    expect((await booking("cancelled")).status).toBe("cancelled");
  });

  it("повторный запуск ничего не отправляет", async () => {
    messages = [];
    await run();
    expect(mine()).toHaveLength(0);
  });

  it("параллельные запуски (разные инстансы функции) не дублируют сообщение", async () => {
    await prisma.booking.update({ where: { id: ids.day.id }, data: { reminderDaySentAt: null } });
    messages = [];
    const clients = [1, 2, 3].map(() => createSql(workerUrl!));
    try {
      await Promise.all(clients.map((client) => runNotifications({ sql: client, send, appUrl: "", now })));
    } finally {
      await Promise.all(clients.map((client) => client.end()));
    }
    expect(mine()).toHaveLength(1);
  });

  it("временная ошибка Telegram — повтор, постоянная — отметка без повтора", async () => {
    await prisma.booking.update({ where: { id: ids.day.id }, data: { reminderDaySentAt: null } });
    mode = "retry";
    expect((await run()).day.retry).toBe(1);
    expect((await booking("day")).reminderDaySentAt).toBeNull();

    mode = "permanent";
    expect((await run()).day.failed).toBe(1);
    expect((await booking("day")).reminderDaySentAt).not.toBeNull();
    mode = "ok";
  });

  it("оценка кнопкой создаёт отзыв, ответ на подсказку сохраняет комментарий", async () => {
    const rate = (data: string) =>
      post({
        callback_query: {
          id: String(updateId),
          from,
          chat_instance: "1",
          data,
          message: { message_id: 20, date: Math.floor(Date.now() / 1000), chat, text: "x" },
        },
      });

    await rate(`r:${ids.review.token}:5`);
    const review = await prisma.review.findUniqueOrThrow({ where: { bookingId: ids.review.id } });
    expect(review.rating).toBe(5);
    expect(review.isPublic).toBe(true);

    await rate(`r:${ids.review.token}:1`);
    expect((await prisma.review.findUniqueOrThrow({ where: { bookingId: ids.review.id } })).rating).toBe(5);

    await post({
      message: {
        message_id: 30,
        date: Math.floor(Date.now() / 1000),
        chat,
        from,
        text: "Отличная стрижка",
        reply_to_message: {
          message_id: 21,
          date: Math.floor(Date.now() / 1000),
          chat,
          from: { id: 1, is_bot: true, first_name: "Usto" },
          text: REVIEW_COMMENT_PROMPT,
        },
      },
    });
    expect((await prisma.review.findUniqueOrThrow({ where: { bookingId: ids.review.id } })).comment).toBe(
      "Отличная стрижка",
    );
  });
});
