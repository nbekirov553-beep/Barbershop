import type { InlineKeyboardMarkup } from "./messages.ts";

export type SendResult = { ok: true } | { ok: false; permanent: boolean; description: string };

export type SendMessage = (chatId: string, text: string, keyboard?: InlineKeyboardMarkup) => Promise<SendResult>;

type TelegramResponse = { ok: boolean; error_code?: number; description?: string };

/** 400/403 (чат не найден, бот заблокирован) повторять бессмысленно; сеть, 429 и 5xx — повторим в следующий запуск. */
export function createTelegramSender(botToken: string, fetchImpl: typeof fetch = fetch): SendMessage {
  return async (chatId, text, keyboard) => {
    try {
      const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: keyboard,
        }),
      });
      const data = (await response.json()) as TelegramResponse;
      if (data.ok) return { ok: true };
      const code = data.error_code ?? response.status;
      return { ok: false, permanent: code === 400 || code === 403, description: data.description ?? `HTTP ${code}` };
    } catch (error) {
      return { ok: false, permanent: false, description: error instanceof Error ? error.message : String(error) };
    }
  };
}
