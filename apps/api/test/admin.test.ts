import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@barbershop/db";
import {
  addDays,
  getWeekday,
  type AdminBarber,
  type AdminBooking,
  type AdminService,
  type AdminSettings,
  type AdminTimeOff,
} from "@barbershop/shared";
import { buildApp } from "../src/app";
import { ADMIN_COOKIE, hashPassword } from "../src/admin/auth";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const LOGIN = `test-admin-${randomBytes(4).toString("hex")}`;
const PASSWORD = "correct-horse-battery";
const PHONE = "+998990000031";

describe.skipIf(!databaseUrl)("Админка: вход, записи, каталог, настройки", () => {
  let prisma: PrismaClient;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookie = "";
  let barber: AdminBarber;
  let serviceId: string;
  let booking: AdminBooking;
  const createdServiceIds: string[] = [];

  const api = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });

  const tomorrow = () => addDays(new Date().toISOString().slice(0, 10), 2);

  beforeAll(async () => {
    prisma = createPrismaClient(databaseUrl);
    app = await buildApp({ prisma, corsOrigins: [], logger: false });
    await prisma.adminUser.create({ data: { login: LOGIN, passwordHash: await hashPassword(PASSWORD) } });
  });

  afterAll(async () => {
    if (!app) return;
    if (barber) {
      await prisma.booking.deleteMany({ where: { barberId: barber.id } });
      await prisma.timeOff.deleteMany({ where: { barberId: barber.id } });
      await prisma.barber.deleteMany({ where: { id: barber.id } });
    }
    await prisma.client.deleteMany({ where: { phone: PHONE } });
    await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
    await prisma.adminUser.deleteMany({ where: { login: { startsWith: "test-admin-" } } });
    await app.close();
  });

  it("без сессии админские маршруты закрыты", async () => {
    expect((await api("GET", "/api/v1/admin/bookings?from=2026-10-01&to=2026-10-02")).statusCode).toBe(401);
    expect((await api("GET", "/api/v1/admin/me")).statusCode).toBe(401);
  });

  it("неверный пароль — 401, верный — httpOnly cookie", async () => {
    const wrong = await api("POST", "/api/v1/admin/login", { login: LOGIN, password: "nope" });
    expect(wrong.statusCode).toBe(401);

    const ok = await api("POST", "/api/v1/admin/login", { login: LOGIN.toUpperCase(), password: PASSWORD });
    expect(ok.statusCode).toBe(200);
    const setCookie = String(ok.headers["set-cookie"]);
    expect(setCookie).toContain(`${ADMIN_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    cookie = setCookie.split(";")[0];

    expect((await api("GET", "/api/v1/admin/me")).json()).toEqual({ login: LOGIN });
  });

  it("rate limit на вход по логину", async () => {
    const target = `test-admin-limit-${randomBytes(3).toString("hex")}`;
    const codes: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      codes.push((await api("POST", "/api/v1/admin/login", { login: target, password: "x" })).statusCode);
    }
    expect(codes.slice(0, 10).every((code) => code === 401)).toBe(true);
    expect(codes[10]).toBe(429);
  });

  it("услуги: создание, изменение, удаление", async () => {
    const created = await api("POST", "/api/v1/admin/services", {
      name: "Тест-услуга",
      category: "hair",
      durationMin: 30,
      price: 50_000,
    });
    expect(created.statusCode).toBe(201);
    const service = created.json<AdminService>();
    createdServiceIds.push(service.id);

    const patched = await api("PATCH", `/api/v1/admin/services/${service.id}`, { price: 70_000, isActive: false });
    expect(patched.json<AdminService>()).toMatchObject({ price: 70_000, isActive: false });

    expect((await api("DELETE", `/api/v1/admin/services/${service.id}`)).statusCode).toBe(204);
  });

  it("барбер: создание и недельный график с обедом", async () => {
    const created = await api("POST", "/api/v1/admin/barbers", { name: "Тест Мастер", experienceYears: 3 });
    expect(created.statusCode).toBe(201);
    barber = created.json<AdminBarber>();
    expect(barber.services.length).toBeGreaterThan(0);

    const invalid = await api("PUT", `/api/v1/admin/barbers/${barber.id}/schedule`, {
      workingHours: [{ weekday: 1, startTime: "10:00", endTime: "20:00" }],
      breaks: [{ weekday: 1, startTime: "21:00", endTime: "22:00" }],
    });
    expect(invalid.statusCode).toBe(400);

    const workingHours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "10:00", endTime: "20:00" }));
    const scheduled = await api("PUT", `/api/v1/admin/barbers/${barber.id}/schedule`, {
      workingHours,
      breaks: [{ weekday: getWeekday(tomorrow()), startTime: "14:00", endTime: "15:00" }],
    });
    expect(scheduled.statusCode).toBe(200);
    barber = scheduled.json<AdminBarber>();
    expect(barber.workingHours).toHaveLength(7);
    expect(barber.breaks).toHaveLength(1);
  });

  it("запись вручную, перенос, запрет отметки будущего визита, отмена", async () => {
    const services = (await api("GET", "/api/v1/admin/services")).json<AdminService[]>();
    serviceId = services.find((service) => service.isActive)!.id;
    const date = tomorrow();

    const availability = await api(
      "GET",
      `/api/v1/admin/availability?serviceIds=${serviceId}&barberId=${barber.id}&date=${date}`,
    );
    const { slots } = availability.json<{ slots: string[] }>();
    expect(slots).toContain("10:00");
    expect(slots).not.toContain("14:00");

    const created = await api("POST", "/api/v1/admin/bookings", {
      serviceIds: [serviceId],
      barberId: barber.id,
      startsAt: `${date}T10:00:00+05:00`,
      client: { name: "Admin Test", phone: PHONE },
    });
    expect(created.statusCode).toBe(201);
    booking = created.json<AdminBooking>();
    expect(booking.source).toBe("admin");

    const moved = await api("PATCH", `/api/v1/admin/bookings/${booking.id}`, { startsAt: `${date}T16:00:00+05:00` });
    expect(moved.statusCode).toBe(200);
    expect(moved.json<AdminBooking>().startsAt).toBe(new Date(`${date}T16:00:00+05:00`).toISOString());

    const early = await api("PATCH", `/api/v1/admin/bookings/${booking.id}`, { status: "completed" });
    expect(early.statusCode).toBe(422);

    const list = await api("GET", `/api/v1/admin/bookings?from=${date}&to=${date}&barberId=${barber.id}`);
    expect(list.json<AdminBooking[]>().map((item) => item.id)).toEqual([booking.id]);

    const cancelled = await api("PATCH", `/api/v1/admin/bookings/${booking.id}`, { status: "cancelled" });
    expect(cancelled.json<AdminBooking>().status).toBe("cancelled");
  });

  it("исключение считает конфликтующие записи", async () => {
    const date = tomorrow();
    await api("POST", "/api/v1/admin/bookings", {
      serviceIds: [serviceId],
      barberId: barber.id,
      startsAt: `${date}T11:00:00+05:00`,
      client: { name: "Admin Test", phone: PHONE },
    });
    const created = await api("POST", "/api/v1/admin/time-off", {
      barberId: barber.id,
      type: "sick_leave",
      from: `${date}T00:00`,
      to: `${date}T23:59`,
    });
    expect(created.statusCode).toBe(201);
    const timeOff = created.json<AdminTimeOff>();
    expect(timeOff.conflicts).toBe(1);

    const slots = await api("GET", `/api/v1/admin/availability?serviceIds=${serviceId}&barberId=${barber.id}&date=${date}`);
    expect(slots.json<{ slots: string[] }>().slots).toHaveLength(0);
    expect((await api("DELETE", `/api/v1/admin/time-off/${timeOff.id}`)).statusCode).toBe(204);
  });

  it("мастера с записями нельзя удалить", async () => {
    expect((await api("DELETE", `/api/v1/admin/barbers/${barber.id}`)).statusCode).toBe(409);
  });

  it("настройки читаются и сохраняются", async () => {
    const before = (await api("GET", "/api/v1/admin/settings")).json<AdminSettings>();
    const { timezone, ...input } = before;
    expect(timezone).toBe("Asia/Tashkent");

    const saved = await api("PUT", "/api/v1/admin/settings", { ...input, cancelCutoffMin: 45 });
    expect(saved.json<AdminSettings>().cancelCutoffMin).toBe(45);
    await api("PUT", "/api/v1/admin/settings", input);
  });

  it("выход удаляет сессию", async () => {
    expect((await api("POST", "/api/v1/admin/logout")).statusCode).toBe(204);
    expect((await api("GET", "/api/v1/admin/me")).statusCode).toBe(401);
  });
});
