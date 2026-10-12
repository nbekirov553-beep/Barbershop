const priceFormatter = new Intl.NumberFormat("ru-RU");

export function formatPrice(value: number): string {
  return `${priceFormatter.format(value)} сум`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

export function pluralize(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${forms[0]}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}

const parseDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const getDayOfMonth = (iso: string) => parseDate(iso).getUTCDate();

export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(parseDate(iso));
}

export function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { month: "short", timeZone: "UTC" })
    .format(parseDate(iso))
    .replace(".", "");
}

/** Приводит ввод к виду «+998 90 123-45-67». */
export function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && (raw.trim().startsWith("+") || digits.length > 9)) {
    digits = digits.slice(3);
  }
  digits = digits.slice(0, 9);

  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 7),
    digits.slice(7, 9),
  ].filter(Boolean);

  if (parts.length === 0) return "";
  const [operator, first, second, third] = parts;
  return `+998 ${operator}${first ? ` ${first}` : ""}${second ? `-${second}` : ""}${third ? `-${third}` : ""}`;
}

export const isValidPhone = (value: string) => value.replace(/\D/g, "").length === 12;
export const isValidName = (value: string) => value.trim().length >= 2;
