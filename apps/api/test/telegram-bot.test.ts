import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@barbershop/db";
import type { Availability, AvailabilityDays, Barber, BookingView, Service } from "@barbershop/shared";
import { TELEGRAM_WEBHOOK_PATH, buildApp } from "../src/app";
import { createBarberLinkCode } from "../src/telegram/link-codes";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const SECRET = "test-secret";
const PHONE = "+998990000011";
const CLIENT_TG = 990_001;
const BARBER_TG = 990_002;

type Call = { method: string; payload: Record<string, unknown> };

describe.skipIf(!databaseUrl)("Telegram-бот: deep links, отмена, уведомления", () => {
  let prisma: PrismaClient;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let calls: Call[] = [];
  let barber: Barber;
  let originalBarberChat: bigint | null = null;
  let booking: BookingView;
  let updateId = 1;

  const sent = (chatId: number) =>
    calls.filter((call) => call.method === "sendMessage" && String(call.payload.chat_id) === String(chatId));

  const waitFor = async (predicate: () => boolean) => {
    for (let i = 0; i < 50 && !predicate(); i += 1) await new Promise((r) => setTimeout(r, 100));
    expect(predicate()).toBe(true);
  };

  const post = (body: object) =>
    app.inject({
      method: "POST",
      url: TELEGRAM_WEBHOOK_PATH,
      headers: { "x-telegram-bot-api-secret-token": SECRET },
      payload: { update_id: updateId++, ...body },
    });

  const message = (from: number, text: string) =>
    post({
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: from, type: "private", first_name: "Test" },
        from: { id: from, is_bot: false, first_name: "Test" },
        text,
        entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }],
      },
    });

  const callback = (from: number, data: string) =>
    post({
      callback_query: {
        id: String(updateId),
        from: { id: from, is_bot: false, first_name: "Test" },
        chat_instance: "1",
        data,
        message: { message_id: 10, date: Math.floor(Date.now() / 1000), chat: { id: from, type: "private" }, text: "x" },
      },
    });

  const cleanup = async () => {
    await prisma.booking.deleteMany({ where: { client: { phone: PHONE } } });
    await prisma.client.deleteMany({ where: { phone: PHONE } });
  };

  beforeAll(async () => {
    prisma = createPrismaClient(databaseUrl);
    app = await buildApp({
      prisma,
      corsOrigins: [],
      logger: false,
      bot: { token: "1:test", mode: "webhook", webhookSecret: SECRET, links: { appUrl: "http://localhost:3000" } },
    });
    app.bot!.api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload: payload as Record<string, unknown> });
      const result =
        method === "getMe"
          ? { id: 1, is_bot: true, first_name: "Usto", username: "usto_test_bot", can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false }
          : true;
      return { ok: true, result } as never;
    });
    await cleanup();

    const barbers = (await app.inject("/api/v1/barbers")).json<Barber[]>();
    barber = barbers[1];
    originalBarberChat = (await prisma.barber.findUniqueOrThrow({ where: { id: barber.id } })).telegramChatId;
  });

  afterAll(async () => {
    if (!app) return;
    await cleanup();
    await prisma.barber.update({ where: { id: barber.id }, data: { telegramChatId: originalBarberChat } });
    await app.close();
  });

  it("одноразовая ссылка привязывает чат барбера и не срабатывает повторно", async () => {
    const { code } = await createBarberLinkCode(prisma, barber.id);
    await message(BARBER_TG, `/start barber_${code}`);
    const linked = await prisma.barber.findUniqueOrThrow({ where: { id: barber.id } });
    expect(linked.telegramChatId).toBe(BigInt(BARBER_TG));
    expect(String(sent(BARBER_TG).at(-1)?.payload.text)).toContain("Готово");

    await message(BARBER_TG, `/start barber_${code}`);
    expect(String(sent(BARBER_TG).at(-1)?.payload.text)).toContain("недействительна");
  });

  it("новая запись с сайта уведомляет барбера", async () => {
    const services = (await app.inject("/api/v1/services")).json<Service[]>();
    const query = `serviceIds=${services[0].id}&barberId=${barber.id}`;
    const { days } = (await app.inject(`/api/v1/availability/days?${query}`)).json<AvailabilityDays>();
    const date = days.filter((day) => day.available).at(-1)!.date;
    const { slots } = (await app.inject(`/api/v1/availability?${query}&date=${date}`)).json<Availability>();

    calls = [];
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bookings",
      payload: {
        serviceIds: [services[0].id],
        barberId: barber.id,
        startsAt: `${date}T${slots.at(-1)}:00+05:00`,
        client: { name: "Bot Test", phone: PHONE },
      },
    });
    expect(response.statusCode).toBe(201);
    booking = response.json<BookingView>();

    await waitFor(() => sent(BARBER_TG).some((call) => String(call.payload.text).includes("Новая запись")));
  });

  it("deep link b_<token> связывает Telegram с клиентом записи", async () => {
    calls = [];
    await message(CLIENT_TG, `/start b_${booking.token}`);
    const client = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE } });
    expect(client.telegramId).toBe(BigInt(CLIENT_TG));
    expect(client.telegramChatId).toBe(BigInt(CLIENT_TG));
    expect(String(sent(CLIENT_TG).at(-1)?.payload.text)).toContain("Ваша запись");
  });

  it("чужой Telegram не может отменить запись", async () => {
    calls = [];
    await callback(123_456, `cy:${booking.token}`);
    const answer = calls.find((call) => call.method === "answerCallbackQuery");
    expect(String(answer?.payload.text)).toContain("не найдена");
    expect((await prisma.booking.findUniqueOrThrow({ where: { manageToken: booking.token } })).status).toBe("confirmed");
  });

  it("отмена кнопкой с подтверждением уведомляет барбера", async () => {
    calls = [];
    await callback(CLIENT_TG, `c:${booking.token}`);
    expect(calls.some((call) => call.method === "editMessageReplyMarkup")).toBe(true);

    await callback(CLIENT_TG, `cy:${booking.token}`);
    expect((await prisma.booking.findUniqueOrThrow({ where: { manageToken: booking.token } })).status).toBe("cancelled");
    expect(calls.some((call) => call.method === "editMessageText")).toBe(true);
    await waitFor(() => sent(BARBER_TG).some((call) => String(call.payload.text).includes("Отмена записи")));
    expect(sent(CLIENT_TG)).toHaveLength(0);
  });
});
