import { randomBytes, randomUUID } from "node:crypto";
import { createPrismaClient } from "@barbershop/db";
import { addDays, getWeekday, toZoned, zonedToUtc } from "@barbershop/shared";
import { loadSettings } from "../domain/settings";
import { env } from "../env";

/**
 * Демо-история для аналитики: прошедшие записи за последние недели у текущих мастеров.
 *   npm run analytics:demo            — пересоздать демо-записи (8 недель)
 *   npm run analytics:demo -- 12      — за 12 недель
 *   npm run analytics:demo -- --clean — удалить всё демо
 * Демо-клиенты узнаются по префиксу телефона, реальные записи не трогаются.
 */
const DEMO_PHONE_PREFIX = "+99890900";
const CLIENTS = 350;
const REGULARS = 40;
const NAMES = ["Азиз", "Бобур", "Жасур", "Тимур", "Сардор", "Отабек", "Шерзод", "Улугбек", "Алексей", "Дмитрий", "Рустам", "Фаррух", "Нодир", "Санжар", "Эльдор", "Камрон"];

const args = process.argv.slice(2);
const isClean = args.includes("--clean");
const weeks = Number(args.find((arg) => /^\d+$/.test(arg)) ?? 8);

/** Детерминированный генератор: один и тот же набор данных при каждом запуске. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(2026);
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
const minutesOf = (value: Date) => value.getUTCHours() * 60 + value.getUTCMinutes();

/** Вероятность, что слот занят: вечер и выходные плотнее. */
function demand(weekday: number, minutes: number) {
  const hour = minutes / 60;
  const base = weekday === 6 || weekday === 0 ? 0.62 : weekday === 5 ? 0.5 : 0.36;
  const evening = hour >= 17 ? 0.22 : hour >= 15 ? 0.1 : hour < 12 ? -0.12 : 0;
  return Math.max(0.05, Math.min(0.9, base + evening));
}

const prisma = createPrismaClient(env.DATABASE_URL);

async function clean() {
  const demoClients = { client: { phone: { startsWith: DEMO_PHONE_PREFIX } } };
  const { count } = await prisma.booking.deleteMany({ where: demoClients });
  await prisma.client.deleteMany({ where: { phone: { startsWith: DEMO_PHONE_PREFIX } } });
  return count;
}

try {
  const removed = await clean();
  if (isClean) {
    console.log(`Демо удалено: ${removed} записей.`);
  } else {
    const { timezone } = await loadSettings(prisma);
    const today = toZoned(new Date(), timezone).date;
    const from = addDays(today, -weeks * 7);
    const [barbers, timeOff, existing] = await Promise.all([
      prisma.barber.findMany({
        where: { isActive: true },
        include: { workingHours: true, breaks: true, services: { where: { isEnabled: true }, include: { service: true } } },
      }),
      prisma.timeOff.findMany({ where: { endsAt: { gt: zonedToUtc(from, 0, timezone) } } }),
      prisma.booking.findMany({
        where: { startsAt: { gte: zonedToUtc(from, 0, timezone) }, status: { not: "cancelled" } },
        select: { barberId: true, startsAt: true, endsAt: true },
      }),
    ]);

    const clients = Array.from({ length: CLIENTS }, (_, index) => ({
      id: randomUUID(),
      phone: `${DEMO_PHONE_PREFIX}${String(index + 1).padStart(4, "0")}`,
      name: `${NAMES[index % NAMES.length]} (демо)`,
    }));
    await prisma.client.createMany({ data: clients });
    // Постоянные клиенты приходят чаще: так видна возвращаемость.
    const pickClient = () => (random() < 0.4 ? clients[Math.floor(random() * REGULARS)] : pick(clients));

    const rows = [];
    const now = Date.now();
    for (let date = from; date < today; date = addDays(date, 1)) {
      const weekday = getWeekday(date);
      for (const barber of barbers) {
        const hours = barber.workingHours.find((item) => item.weekday === weekday);
        const services = barber.services.filter((item) => item.service.isActive);
        if (!hours || services.length === 0) continue;
        const breaks = barber.breaks.filter((item) => item.weekday === weekday);
        const at = (minutes: number) => zonedToUtc(date, minutes, timezone);
        const busy = (start: Date, end: Date) =>
          timeOff.some((item) => (item.barberId === null || item.barberId === barber.id) && item.startsAt < end && item.endsAt > start) ||
          existing.some((item) => item.barberId === barber.id && item.startsAt < end && item.endsAt > start);

        let cursor = minutesOf(hours.startTime);
        const dayEnd = minutesOf(hours.endTime);
        while (cursor < dayEnd) {
          const lunch = breaks.find((item) => cursor >= minutesOf(item.startTime) && cursor < minutesOf(item.endTime));
          if (lunch) {
            cursor = minutesOf(lunch.endTime);
            continue;
          }
          if (random() > demand(weekday, cursor)) {
            cursor += 30;
            continue;
          }
          // Стрижка заметно популярнее остальных услуг.
          const first = random() < 0.45 ? services[0] : pick(services);
          const extra = random() < 0.18 ? pick(services.filter((item) => item.serviceId !== first.serviceId)) : undefined;
          const chosen = [first, ...(extra ? [extra] : [])];
          const lines = chosen.map((item) => ({
            serviceId: item.serviceId,
            name: item.service.name,
            durationMin: item.durationMin ?? item.service.durationMin,
            price: item.price ?? item.service.price,
          }));
          const duration = lines.reduce((sum, item) => sum + item.durationMin, 0);
          const end = cursor + duration;
          const crossesLunch = breaks.some((item) => cursor < minutesOf(item.endTime) && end > minutesOf(item.startTime));
          const startsAt = at(cursor);
          const endsAt = at(end);
          if (end > dayEnd || crossesLunch || busy(startsAt, endsAt) || endsAt.getTime() > now) {
            cursor += 30;
            continue;
          }

          const roll = random();
          const status = roll < 0.08 ? "cancelled" : roll < 0.13 ? "no_show" : "completed";
          const sourceRoll = random();
          rows.push({
            clientId: pickClient().id,
            barberId: barber.id,
            startsAt,
            endsAt,
            totalDurationMin: duration,
            totalPrice: lines.reduce((sum, item) => sum + item.price, 0),
            status,
            source: sourceRoll < 0.45 ? "telegram" : sourceRoll < 0.85 ? "web" : "admin",
            manageToken: randomBytes(24).toString("base64url"),
            // Отметки, чтобы воркер уведомлений не трогал историю.
            reminderDaySentAt: startsAt,
            reminder30mSentAt: startsAt,
            reviewRequestedAt: endsAt,
            lines,
          } as const);
          cursor = end + (random() < 0.3 ? 15 : 0);
        }
      }
    }

    const withIds = rows.map((row) => ({ ...row, id: randomUUID() }));
    await prisma.booking.createMany({ data: withIds.map(({ lines: _lines, ...data }) => data) });
    await prisma.bookingService.createMany({
      data: withIds.flatMap((row) => row.lines.map((line) => ({ ...line, bookingId: row.id }))),
    });
    console.log(`Демо готово: ${rows.length} записей за ${weeks} нед. (${from} – ${addDays(today, -1)}), ${CLIENTS} клиентов.`);
    console.log("Удалить: npm run analytics:demo -- --clean");
  }
} finally {
  await prisma.$disconnect();
}
