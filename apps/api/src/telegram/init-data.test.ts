import { describe, expect, it } from "vitest";
import { InitDataError, signInitData, validateInitData } from "./init-data";

const BOT_TOKEN = "123456:TEST-token";
const NOW = Date.UTC(2026, 9, 9, 12, 0);
const authDate = String(Math.floor(NOW / 1000) - 60);
const user = JSON.stringify({ id: 42, first_name: "Нариман", username: "nariman" });

const reasonOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof InitDataError ? error.reason : "OTHER";
  }
  return "OK";
};

describe("validateInitData", () => {
  it("принимает корректно подписанные данные", () => {
    const raw = signInitData({ auth_date: authDate, query_id: "AAE", user }, BOT_TOKEN);
    expect(validateInitData(raw, BOT_TOKEN, { maxAgeSec: 3600, now: NOW })).toEqual({
      id: 42,
      firstName: "Нариман",
      lastName: undefined,
      username: "nariman",
    });
  });

  it("отклоняет подпись чужого бота", () => {
    const raw = signInitData({ auth_date: authDate, user }, "999:other");
    expect(reasonOf(() => validateInitData(raw, BOT_TOKEN, { maxAgeSec: 3600, now: NOW }))).toBe(
      "BAD_SIGNATURE",
    );
  });

  it("отклоняет подменённого пользователя", () => {
    const params = new URLSearchParams(signInitData({ auth_date: authDate, user }, BOT_TOKEN));
    params.set("user", user.replace('"id":42', '"id":43'));
    expect(reasonOf(() => validateInitData(params.toString(), BOT_TOKEN, { maxAgeSec: 3600, now: NOW }))).toBe(
      "BAD_SIGNATURE",
    );
  });

  it("отклоняет устаревшие данные", () => {
    const old = String(Math.floor(NOW / 1000) - 7200);
    const raw = signInitData({ auth_date: old, user }, BOT_TOKEN);
    expect(reasonOf(() => validateInitData(raw, BOT_TOKEN, { maxAgeSec: 3600, now: NOW }))).toBe(
      "EXPIRED",
    );
  });

  it("требует hash и user", () => {
    expect(reasonOf(() => validateInitData(`auth_date=${authDate}`, BOT_TOKEN, { maxAgeSec: 3600 }))).toBe(
      "MISSING_HASH",
    );
    const raw = signInitData({ auth_date: authDate }, BOT_TOKEN);
    expect(reasonOf(() => validateInitData(raw, BOT_TOKEN, { maxAgeSec: 3600, now: NOW }))).toBe("NO_USER");
  });
});
