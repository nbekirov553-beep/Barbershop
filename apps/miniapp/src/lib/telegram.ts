import WebApp from "@twa-dev/sdk";
import { useEffect, useRef } from "react";

/** Вне Telegram SDK отдаёт initData undefined или пустую строку. */
const initData: string = WebApp.initData ?? "";
export const isInTelegram = initData.length > 0;

const DEV_USER = { id: 1_000_001, firstName: "Гость", username: "dev" };

export function initTelegram() {
  if (!isInTelegram) return;
  WebApp.ready();
  WebApp.expand();
  applyThemeChrome();
  WebApp.onEvent("themeChanged", applyThemeChrome);
}

/** Шапка и фон Telegram-клиента красятся в цвета текущей темы. */
function applyThemeChrome() {
  const bg = WebApp.themeParams.bg_color as `#${string}` | undefined;
  if (!bg || !WebApp.isVersionAtLeast("6.1")) return;
  WebApp.setHeaderColor(bg);
  WebApp.setBackgroundColor(bg);
}

export function getAuthHeader(): string | null {
  if (isInTelegram) return `tma ${initData}`;
  if (import.meta.env.DEV) {
    // Заголовки HTTP допускают только ASCII, поэтому кириллица экранируется как \uXXXX.
    const json = JSON.stringify(DEV_USER).replace(
      /[\u0080-\uffff]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
    return `tma-dev ${json}`;
  }
  return null;
}

export function getFirstName(): string {
  if (!isInTelegram) return DEV_USER.firstName;
  return WebApp.initDataUnsafe?.user?.first_name ?? "";
}

export const haptic = {
  select: () => isInTelegram && WebApp.HapticFeedback.selectionChanged(),
  tap: () => isInTelegram && WebApp.HapticFeedback.impactOccurred("light"),
  success: () => isInTelegram && WebApp.HapticFeedback.notificationOccurred("success"),
  error: () => isInTelegram && WebApp.HapticFeedback.notificationOccurred("error"),
};

/** Нативная кнопка «Назад» Telegram; null — скрыть. */
export function useTelegramBackButton(onBack: (() => void) | null) {
  const handler = useRef(onBack);

  useEffect(() => {
    handler.current = onBack;
  });

  const isVisible = onBack !== null;

  useEffect(() => {
    if (!isInTelegram || !WebApp.isVersionAtLeast("6.1")) return;
    if (!isVisible) {
      WebApp.BackButton.hide();
      return;
    }
    const listener = () => handler.current?.();
    WebApp.BackButton.onClick(listener);
    WebApp.BackButton.show();
    return () => {
      WebApp.BackButton.offClick(listener);
    };
  }, [isVisible]);
}

/** В Telegram своя кнопка «Назад» в шапке, в браузере показываем свою. */
export const needsInlineBack = !isInTelegram || !WebApp.isVersionAtLeast("6.1");
