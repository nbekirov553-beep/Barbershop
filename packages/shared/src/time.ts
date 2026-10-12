/** Даты в формате YYYY-MM-DD и время HH:MM считаются в часовом поясе салона. */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function toZoned(instant: Date, timeZone: string): { date: string; time: string; minutes: number } {
  const parts = getFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const time = `${get("hour")}:${get("minute")}`;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time, minutes: toMinutes(time) };
}

function getOffsetMinutes(instant: Date, timeZone: string): number {
  const zoned = toZoned(instant, timeZone);
  const asUtc = Date.UTC(
    Number(zoned.date.slice(0, 4)),
    Number(zoned.date.slice(5, 7)) - 1,
    Number(zoned.date.slice(8, 10)),
    Math.floor(zoned.minutes / 60),
    zoned.minutes % 60,
  );
  return Math.round((asUtc - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

/** Локальные дата+минуты салона -> момент времени UTC. */
export function zonedToUtc(date: string, minutes: number, timeZone: string): Date {
  const guess = new Date(`${date}T00:00:00Z`).getTime() + minutes * 60_000;
  const offset = getOffsetMinutes(new Date(guess), timeZone);
  return new Date(guess - offset * 60_000);
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** 0 = воскресенье ... 6 = суббота. */
export const getWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
