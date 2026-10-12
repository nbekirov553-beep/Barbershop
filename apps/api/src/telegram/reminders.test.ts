import { describe, expect, it } from "vitest";
import { ratingKeyboard, reminderKeyboard, reminderMarks, reminderMessages } from "@barbershop/notifications";

const settings = { reminderDayMin: 1440, reminderShortMin: 30 };
const now = new Date("2026-10-09T10:00:00Z");
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const token = "x".repeat(32);

describe("reminderMarks", () => {
  it("запись больше чем за сутки — оба напоминания впереди", () => {
    expect(reminderMarks(at(2 * 1440), now, settings)).toEqual({ reminderDaySentAt: null, reminder30mSentAt: null });
  });

  it("запись внутри суток — дневное напоминание уже не нужно", () => {
    expect(reminderMarks(at(300), now, settings)).toEqual({ reminderDaySentAt: now, reminder30mSentAt: null });
  });

  it("запись через 30 минут — оба напоминания пропускаются", () => {
    expect(reminderMarks(at(30), now, settings)).toEqual({ reminderDaySentAt: now, reminder30mSentAt: now });
  });
});

describe("тексты и кнопки напоминаний", () => {
  const booking = {
    manageToken: token,
    startsAt: new Date("2026-10-10T10:00:00Z"),
    endsAt: new Date("2026-10-10T11:00:00Z"),
    barberName: "Тимур <b>",
    services: "Стрижка, Борода",
  };

  it("время в часовом поясе салона, HTML экранирован", () => {
    const text = reminderMessages.day(booking, "Asia/Tashkent");
    expect(text).toContain("15:00–16:00");
    expect(text).toContain("Тимур &lt;b&gt;");
    expect(reminderMessages.short(booking, "Asia/Tashkent")).toContain("<b>15:00</b>");
  });

  it("callback_data укладывается в лимит Telegram 64 байта", () => {
    const callbacks = [...reminderKeyboard(token, "http://localhost:3000").inline_keyboard, ...ratingKeyboard(token).inline_keyboard]
      .flat()
      .flatMap((button) => ("callback_data" in button ? [button.callback_data] : []));
    expect(callbacks.length).toBe(6);
    for (const data of callbacks) expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(64);
  });

  it("кнопка «Перенести» только для HTTPS-адреса сайта", () => {
    expect(reminderKeyboard(token, "http://localhost:3000").inline_keyboard[0]).toHaveLength(1);
    expect(reminderKeyboard(token, "https://usto.uz").inline_keyboard[0]).toHaveLength(2);
  });
});
