import type { PrismaClient } from "@barbershop/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TELEGRAM_WEBHOOK_PATH, buildApp } from "../app";

const SECRET = "test-webhook-secret";
const calls: { method: string; payload: Record<string, unknown> }[] = [];

const prismaStub = { $disconnect: async () => {} } as unknown as PrismaClient;

const update = (text: string) => ({
  update_id: 1,
  message: {
    message_id: 1,
    date: Math.floor(Date.now() / 1000),
    chat: { id: 777, type: "private", first_name: "Test" },
    from: { id: 777, is_bot: false, first_name: "Test" },
    text,
    entities: text.startsWith("/") ? [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] : [],
  },
});

describe("POST /telegram/webhook", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      prisma: prismaStub,
      corsOrigins: [],
      logger: false,
      bot: { token: "1:test", mode: "webhook", webhookSecret: SECRET, links: { appUrl: "http://localhost:3000" } },
    });
    // Подменяем транспорт Telegram API: запросы не уходят в сеть, а записываются.
    app.bot!.api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload: payload as Record<string, unknown> });
      const result =
        method === "getMe"
          ? { id: 1, is_bot: true, first_name: "Usto", username: "usto_test_bot", can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false }
          : true;
      return { ok: true, result } as never;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("отклоняет запрос без секретного заголовка", async () => {
    const response = await app.inject({ method: "POST", url: TELEGRAM_WEBHOOK_PATH, payload: update("/contacts") });
    expect(response.statusCode).toBe(401);
    expect(calls.filter((call) => call.method === "sendMessage")).toHaveLength(0);
  });

  it("обрабатывает команду и отвечает в чат", async () => {
    const response = await app.inject({
      method: "POST",
      url: TELEGRAM_WEBHOOK_PATH,
      headers: { "x-telegram-bot-api-secret-token": SECRET },
      payload: update("/contacts"),
    });
    expect(response.statusCode).toBe(200);
    const sent = calls.find((call) => call.method === "sendMessage");
    expect(sent?.payload.chat_id).toBe(777);
    expect(String(sent?.payload.text)).toContain("Шахрисабз");
  });
});
