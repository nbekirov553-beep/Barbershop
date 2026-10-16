import { toMinutes, zonedToUtc } from "@barbershop/shared";
import { describe, expect, it } from "vitest";
import {
  availableMinutes,
  computeCancellations,
  computeHeatmap,
  computeLoad,
  computeRetention,
  computeRevenue,
  computeServices,
  type AnalyticsBarber,
  type AnalyticsBooking,
  type AnalyticsTimeOff,
} from "./analytics.js";

const TZ = "Asia/Tashkent";
const at = (date: string, time: string) => zonedToUtc(date, toMinutes(time), TZ);
/** Период: пн 07.09 – вс 13.09.2026. */
const period = { from: "2026-09-07", to: "2026-09-13", timezone: TZ };

const cut = { serviceId: "s1", name: "Стрижка", price: 150_000 };
const beard = { serviceId: "s2", name: "Борода", price: 70_000 };

const booking = (
  barberId: string,
  clientId: string,
  date: string,
  time: string,
  totalDurationMin: number,
  status: AnalyticsBooking["status"],
  source: AnalyticsBooking["source"],
  services: AnalyticsBooking["services"],
): AnalyticsBooking => ({
  barberId,
  clientId,
  startsAt: at(date, time),
  status,
  source,
  totalDurationMin,
  totalPrice: services.reduce((sum, item) => sum + item.price, 0),
  services,
});

const bookings = [
  booking("A", "c1", "2026-09-07", "10:00", 60, "completed", "web", [cut]),
  booking("A", "c2", "2026-09-07", "11:30", 90, "completed", "telegram", [cut, beard]),
  booking("A", "c3", "2026-09-08", "15:00", 60, "cancelled", "web", [cut]),
  booking("A", "c1", "2026-09-10", "16:00", 45, "no_show", "admin", [beard]),
  booking("B", "c4", "2026-09-12", "12:00", 60, "completed", "telegram", [cut]),
  booking("B", "c2", "2026-09-12", "13:30", 60, "confirmed", "web", [cut]),
];
const previous = [
  booking("A", "c1", "2026-08-31", "10:00", 60, "completed", "web", [cut]),
  booking("A", "c5", "2026-08-31", "12:00", 60, "cancelled", "web", [cut]),
];

const weekdays = (days: number[], start: string, end: string) =>
  days.map((weekday) => ({ weekday, startMin: toMinutes(start), endMin: toMinutes(end) }));
const barbers: AnalyticsBarber[] = [
  // Пн–Пт 10–20 с обедом 13–14: 540 минут в день.
  { id: "A", name: "Тимур", workingHours: weekdays([1, 2, 3, 4, 5], "10:00", "20:00"), breaks: weekdays([1, 2, 3, 4, 5], "13:00", "14:00") },
  // Только суббота 12–18: 360 минут.
  { id: "B", name: "Азиз", workingHours: weekdays([6], "12:00", "18:00"), breaks: [] },
];
const timeOff: AnalyticsTimeOff[] = [
  // Ср у A: 10–15 = 180 до обеда + 60 после, обед уже вычтен.
  { barberId: "A", startsAt: at("2026-09-09", "10:00"), endsAt: at("2026-09-09", "15:00") },
  // Пт праздник у всего салона.
  { barberId: null, startsAt: at("2026-09-11", "00:00"), endsAt: at("2026-09-12", "00:00") },
];

describe("аналитика: ручная сверка", () => {
  it("выручка и количество записей", () => {
    const result = computeRevenue(bookings, previous, period);
    // completed: 150 000 + 220 000 + 150 000.
    expect(result.revenue).toBe(520_000);
    expect(result.completed).toBe(3);
    expect(result.averageCheck).toBe(173_333);
    expect(result.bookings).toEqual({
      total: 6,
      byStatus: { confirmed: 1, completed: 3, cancelled: 1, no_show: 1 },
      bySource: { web: 3, telegram: 2, admin: 1 },
    });
    expect(result.previous).toEqual({ from: "2026-08-31", to: "2026-09-06", revenue: 150_000, completed: 1, bookings: 2 });
    expect(result.days).toHaveLength(7);
    expect(result.days[0]).toEqual({ date: "2026-09-07", revenue: 370_000, completed: 2, bookings: 2 });
    expect(result.days[1]).toEqual({ date: "2026-09-08", revenue: 0, completed: 0, bookings: 1 });
    expect(result.days[5]).toEqual({ date: "2026-09-12", revenue: 150_000, completed: 1, bookings: 2 });
  });

  it("популярные услуги без отмен, выручка только по completed", () => {
    expect(computeServices(bookings).services).toEqual([
      { key: "s1", name: "Стрижка", bookings: 4, completed: 3, revenue: 450_000 },
      { key: "s2", name: "Борода", bookings: 2, completed: 1, revenue: 70_000 },
    ]);
  });

  it("доступное время: график минус обеды минус исключения", () => {
    // 5 × 540 = 2700, минус 240 в среду, минус 540 в праздник.
    expect(availableMinutes(barbers[0], timeOff, period)).toBe(1920);
    expect(availableMinutes(barbers[1], timeOff, period)).toBe(360);
  });

  it("загрузка барберов", () => {
    const [a, b] = computeLoad(bookings, barbers, timeOff, period).barbers;
    // A: 60 + 90 + 45 (неявка тоже занимала слот), отмена не считается.
    expect(a).toEqual({ barberId: "A", name: "Тимур", availableMin: 1920, bookedMin: 195, utilization: 195 / 1920, bookings: 3, revenue: 370_000 });
    expect(b).toEqual({ barberId: "B", name: "Азиз", availableMin: 360, bookedMin: 120, utilization: 1 / 3, bookings: 2, revenue: 150_000 });
  });

  it("тепловая карта раскладывает минуты по часам", () => {
    const { minutes, starts, weekdayCount } = computeHeatmap(bookings, period);
    expect(minutes[1].slice(10, 13)).toEqual([60, 30, 60]);
    expect(minutes[2][15]).toBe(0);
    expect(minutes[4][16]).toBe(45);
    expect(minutes[6].slice(12, 15)).toEqual([60, 30, 30]);
    expect(starts[1][10] + starts[1][11]).toBe(2);
    expect(minutes.flat().reduce((sum, value) => sum + value, 0)).toBe(60 + 90 + 45 + 60 + 60);
    expect(weekdayCount).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it("отмены и неявки", () => {
    const result = computeCancellations(bookings, barbers);
    expect(result).toMatchObject({ total: 6, cancelled: 1, cancelRate: 1 / 6, noShow: 1, noShowRate: 1 / 4 });
    expect(result.barbers).toEqual([
      { barberId: "A", name: "Тимур", total: 4, cancelled: 1, noShow: 1, completed: 2 },
      { barberId: "B", name: "Азиз", total: 2, cancelled: 0, noShow: 0, completed: 1 },
    ]);
  });

  it("возвращаемость", () => {
    // completed в периоде: c1, c2, c4; до периода был только c1.
    expect(computeRetention(bookings, new Set(["c1"]))).toEqual({
      clients: 3,
      newClients: 2,
      returningClients: 1,
      returningRate: 1 / 3,
      newRepeated: 0,
    });
    const twice = [...bookings, booking("B", "c4", "2026-09-13", "12:00", 60, "completed", "web", [cut])];
    expect(computeRetention(twice, new Set()).newRepeated).toBe(1);
  });

  it("пустой период не делит на ноль", () => {
    expect(computeRevenue([], [], period)).toMatchObject({ revenue: 0, averageCheck: 0 });
    expect(computeCancellations([], [])).toMatchObject({ cancelRate: 0, noShowRate: 0 });
    expect(computeLoad([], [{ ...barbers[0], workingHours: [] }], [], period).barbers[0].utilization).toBeNull();
  });
});
