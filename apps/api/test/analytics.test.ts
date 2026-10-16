import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@barbershop/db";
import {
  toMinutes,
  zonedToUtc,
  type AnalyticsCancellations,
  type AnalyticsHeatmap,
  type AnalyticsLoad,
  type AnalyticsRetention,
  type AnalyticsRevenue,
  type AnalyticsServices,
} from "@barbershop/shared";
import { buildApp } from "../src/register-api.js";
import { hashPassword } from "../src/admin/auth.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const TZ = "Asia/Tashkent";
const LOGIN = `test-admin-${randomBytes(4).toString("hex")}`;
const PASSWORD = "analytics-check-password";
const PHONES = ["+998990000041", "+998990000042", "+998990000043", "+998990000044"];
const at = (date: string, time: string) => zonedToUtc(date, toMinutes(time), TZ);
const clock = (time: string) => new Date(`1970-01-01T${time}:00Z`);

/** Те же данные, что в ручной сверке domain/analytics.test.ts, но для одного мастера и через БД. */
describe.skipIf(!databaseUrl)("Аналитика: цифры API совпадают с записями в БД", () => {
  let prisma: PrismaClient;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookie = "";
  let barberId = "";

  const get = async <T>(path: string) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/admin/analytics/${path}?from=2026-09-07&to=2026-09-13&barberId=${barberId}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    return response.json<T>();
  };

  beforeAll(async () => {
    prisma = createPrismaClient(databaseUrl);
    app = await buildApp({ prisma, corsOrigins: [], logger: false });
    await prisma.adminUser.create({ data: { login: LOGIN, passwordHash: await hashPassword(PASSWORD) } });
    const login = await app.inject({ method: "POST", url: "/api/v1/admin/login", payload: { login: LOGIN, password: PASSWORD } });
    cookie = String(login.headers["set-cookie"]).split(";")[0];

    const workdays = [1, 2, 3, 4, 5];
    const barber = await prisma.barber.create({
      data: {
        name: "Тест Аналитика",
        isActive: false,
        workingHours: { create: workdays.map((weekday) => ({ weekday, startTime: clock("10:00"), endTime: clock("20:00") })) },
        breaks: { create: workdays.map((weekday) => ({ weekday, startTime: clock("13:00"), endTime: clock("14:00") })) },
      },
    });
    barberId = barber.id;
    await prisma.timeOff.createMany({
      data: [
        { barberId, startsAt: at("2026-09-09", "10:00"), endsAt: at("2026-09-09", "15:00") },
        { barberId, startsAt: at("2026-09-11", "00:00"), endsAt: at("2026-09-12", "00:00"), type: "holiday" },
      ],
    });

    const clients = await Promise.all(
      PHONES.map((phone, index) =>
        prisma.client.upsert({ where: { phone }, update: {}, create: { phone, name: `Клиент ${index + 1}` } }),
      ),
    );
    const [c1, c2, c3, c5] = clients.map((client) => client.id);
    const cut = { name: "Стрижка", durationMin: 60, price: 150_000 };
    const beard = { name: "Борода", durationMin: 30, price: 70_000 };
    const rows = [
      { clientId: c1, date: "2026-09-07", time: "10:00", min: 60, status: "completed", source: "web", services: [cut] },
      { clientId: c2, date: "2026-09-07", time: "11:30", min: 90, status: "completed", source: "telegram", services: [cut, beard] },
      { clientId: c3, date: "2026-09-08", time: "15:00", min: 60, status: "cancelled", source: "web", services: [cut] },
      { clientId: c1, date: "2026-09-10", time: "16:00", min: 45, status: "no_show", source: "admin", services: [beard] },
      { clientId: c1, date: "2026-08-31", time: "10:00", min: 60, status: "completed", source: "web", services: [cut] },
      { clientId: c5, date: "2026-08-31", time: "12:00", min: 60, status: "cancelled", source: "web", services: [cut] },
    ] as const;
    for (const row of rows) {
      const startsAt = at(row.date, row.time);
      const services: { name: string; durationMin: number; price: number }[] = [...row.services];
      await prisma.booking.create({
        data: {
          clientId: row.clientId,
          barberId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + row.min * 60_000),
          totalDurationMin: row.min,
          totalPrice: services.reduce((sum, item) => sum + item.price, 0),
          status: row.status,
          source: row.source,
          manageToken: randomBytes(24).toString("base64url"),
          services: { create: services },
        },
      });
    }
  });

  afterAll(async () => {
    if (!app) return;
    if (barberId) {
      await prisma.booking.deleteMany({ where: { barberId } });
      await prisma.barber.deleteMany({ where: { id: barberId } });
    }
    await prisma.client.deleteMany({ where: { phone: { in: PHONES } } });
    await prisma.adminUser.deleteMany({ where: { login: LOGIN } });
    await app.close();
  });

  it("без сессии закрыто, кривой период — 400", async () => {
    const anonymous = await app.inject({ method: "GET", url: "/api/v1/admin/analytics/revenue?from=2026-09-07&to=2026-09-13" });
    expect(anonymous.statusCode).toBe(401);
    const reversed = await app.inject({
      method: "GET",
      url: "/api/v1/admin/analytics/revenue?from=2026-09-13&to=2026-09-07",
      headers: { cookie },
    });
    expect(reversed.statusCode).toBe(400);
  });

  it("выручка, записи, сравнение с прошлым периодом", async () => {
    const revenue = await get<AnalyticsRevenue>("revenue");
    expect(revenue).toMatchObject({
      revenue: 370_000,
      completed: 2,
      averageCheck: 185_000,
      bookings: {
        total: 4,
        byStatus: { confirmed: 0, completed: 2, cancelled: 1, no_show: 1 },
        bySource: { web: 2, telegram: 1, admin: 1 },
      },
      previous: { from: "2026-08-31", to: "2026-09-06", revenue: 150_000, completed: 1, bookings: 2 },
    });
    expect(revenue.days[0]).toEqual({ date: "2026-09-07", revenue: 370_000, completed: 2, bookings: 2 });
  });

  it("услуги, загрузка, тепловая карта", async () => {
    const { services } = await get<AnalyticsServices>("services");
    expect(services.map(({ name, bookings, completed, revenue }) => ({ name, bookings, completed, revenue }))).toEqual([
      { name: "Стрижка", bookings: 2, completed: 2, revenue: 300_000 },
      { name: "Борода", bookings: 2, completed: 1, revenue: 70_000 },
    ]);

    const load = await get<AnalyticsLoad>("load");
    expect(load.barbers).toEqual([
      { barberId, name: "Тест Аналитика", availableMin: 1920, bookedMin: 195, utilization: 195 / 1920, bookings: 3, revenue: 370_000 },
    ]);

    const heatmap = await get<AnalyticsHeatmap>("heatmap");
    expect(heatmap.minutes[1].slice(10, 13)).toEqual([60, 30, 60]);
    expect(heatmap.minutes[4][16]).toBe(45);
    expect(heatmap.minutes.flat().reduce((sum, value) => sum + value, 0)).toBe(195);
  });

  it("отмены, неявки, возвращаемость", async () => {
    const cancellations = await get<AnalyticsCancellations>("cancellations");
    expect(cancellations).toMatchObject({ total: 4, cancelled: 1, cancelRate: 0.25, noShow: 1, noShowRate: 1 / 3 });

    // c1 был у мастера 31.08, c2 пришёл впервые.
    const retention = await get<AnalyticsRetention>("retention");
    expect(retention).toEqual({ clients: 2, newClients: 1, returningClients: 1, returningRate: 0.5, newRepeated: 0 });
  });
});
