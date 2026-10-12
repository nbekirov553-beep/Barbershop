import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@barbershop/db";
import type { Availability, AvailabilityDays, Barber, Service } from "@barbershop/shared";
import { buildApp } from "../src/app";
import { isExclusionViolation } from "../src/services/bookings";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const TEST_PHONES = ["+998990000001", "+998990000002"];

describe.skipIf(!databaseUrl)("POST /bookings: гонка за один слот", () => {
  let prisma: PrismaClient;
  let app: Awaited<ReturnType<typeof buildApp>>;

  const cleanup = async () => {
    const where = { client: { phone: { in: TEST_PHONES } } };
    await prisma.booking.deleteMany({ where });
    await prisma.client.deleteMany({ where: { phone: { in: TEST_PHONES } } });
  };

  beforeAll(async () => {
    prisma = createPrismaClient(databaseUrl);
    app = await buildApp({ prisma, corsOrigins: [], logger: false });
    await cleanup();
  });

  afterAll(async () => {
    if (!app) return;
    await cleanup();
    await app.close();
  });

  it("из двух одновременных запросов проходит ровно один", async () => {
    const services = (await app.inject("/api/v1/services")).json<Service[]>();
    const barbers = (await app.inject("/api/v1/barbers")).json<Barber[]>();
    const serviceIds = [services[0].id];
    const barberId = barbers[0].id;
    const query = `serviceIds=${serviceIds.join(",")}&barberId=${barberId}`;

    const { days } = (await app.inject(`/api/v1/availability/days?${query}`)).json<AvailabilityDays>();
    const date = days.filter((day) => day.available).at(-1)?.date;
    expect(date, "нет доступного дня для теста").toBeDefined();

    const availability = (
      await app.inject(`/api/v1/availability?${query}&date=${date}`)
    ).json<Availability>();
    const time = availability.slots.at(-1)!;
    const startsAt = `${date}T${time}:00+05:00`;

    const responses = await Promise.all(
      TEST_PHONES.map((phone, index) =>
        app.inject({
          method: "POST",
          url: "/api/v1/bookings",
          payload: { serviceIds, barberId, startsAt, client: { name: `Race ${index + 1}`, phone } },
        }),
      ),
    );

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    const conflict = responses.find((response) => response.statusCode === 409)!;
    expect(conflict.json()).toMatchObject({ code: "SLOT_TAKEN" });
  });

  it("bookings_no_overlap отклоняет пересечение даже в обход проверок API", async () => {
    const barber = await prisma.barber.findFirstOrThrow({ orderBy: { sortOrder: "asc" } });
    const client = await prisma.client.upsert({
      where: { phone: TEST_PHONES[0] },
      update: {},
      create: { name: "Race DB", phone: TEST_PHONES[0] },
    });
    const startsAt = new Date(Date.UTC(2030, 0, 1, 5, 0));
    const overlapStart = new Date(startsAt.getTime() + 30 * 60_000);

    const results = await Promise.allSettled(
      [startsAt, overlapStart].map((start, index) =>
        prisma.booking.create({
          data: {
            clientId: client.id,
            barberId: barber.id,
            startsAt: start,
            endsAt: new Date(start.getTime() + 60 * 60_000),
            totalPrice: 1,
            totalDurationMin: 60,
            manageToken: `race-db-${Date.now()}-${index}`,
          },
        }),
      ),
    );

    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((result) => result.status === "rejected");
    expect(isExclusionViolation(rejected?.reason)).toBe(true);
  });
});
