import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@barbershop/db";
import { reminderMarks } from "@barbershop/notifications";
import { ANY_BARBER, toZoned, type BookingView } from "@barbershop/shared";
import { loadSettings, type BookingSettings } from "../domain/settings.js";
import { AppError, notFound } from "../errors.js";
import type { TelegramUser } from "../telegram/init-data.js";
import {
  computeAvailability,
  isWithinHorizon,
  loadBookingContext,
  type BookingContext,
} from "./availability.js";

const slotTaken = () => new AppError(409, "SLOT_TAKEN", "Это время уже занято, выберите другое");

/** PostgreSQL 23P01 = exclusion_violation (constraint bookings_no_overlap). */
export function isExclusionViolation(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 5) return false;
  const record = error as Record<string, unknown>;
  const text = [record.code, record.originalCode, record.message, record.constraint]
    .filter((value) => typeof value === "string")
    .join(" ");
  if (text.includes("23P01") || text.includes("bookings_no_overlap")) return true;
  return ["cause", "meta"].some((key) => isExclusionViolation(record[key], depth + 1));
}

/** admin: запись из админки — без min_notice, горизонта и cutoff, но с проверкой графика и пересечений. */
export type ActorOptions = { admin?: boolean };

/** Проверяет время по правилам салона и возвращает мастеров, свободных в этот момент. */
async function resolveCandidates(
  prisma: PrismaClient,
  context: BookingContext,
  startsAt: Date,
  options: ActorOptions & { excludeBookingId?: string } = {},
): Promise<string[]> {
  const { settings, now } = context;
  const local = toZoned(startsAt, settings.timezone);

  if (options.admin) {
    if (startsAt.getTime() < now.getTime()) {
      throw new AppError(422, "PAST_TIME", "Нельзя записать на прошедшее время");
    }
  } else {
    if (startsAt.getTime() < now.getTime() + settings.minNoticeMin * 60_000) {
      throw new AppError(
        422,
        "TOO_SOON",
        `Записаться можно не позднее чем за ${settings.minNoticeMin} мин до начала`,
      );
    }
    if (!isWithinHorizon(context, local.date)) {
      throw new AppError(
        422,
        "TOO_FAR",
        `Запись открыта на ${settings.bookingHorizonDays} дней вперёд`,
      );
    }
  }

  const range = {
    from: local.date,
    to: local.date,
    excludeBookingId: options.excludeBookingId,
    admin: options.admin,
  };
  const available = (await computeAvailability(prisma, context, range)).get(local.date);
  const candidates = context.barbers
    .filter((barber) => available?.get(barber.id)?.includes(local.minutes))
    .map((barber) => barber.id);
  if (candidates.length > 0) return candidates;

  const withoutBookings = (
    await computeAvailability(prisma, context, { ...range, ignoreBookings: true })
  ).get(local.date);
  const fitsSchedule = context.barbers.some((barber) =>
    withoutBookings?.get(barber.id)?.includes(local.minutes),
  );
  if (!fitsSchedule) {
    throw new AppError(422, "OUTSIDE_WORKING_HOURS", "Это время вне рабочего графика мастера");
  }
  throw slotTaken();
}

const bookingInclude = {
  barber: { select: { id: true, name: true } },
  client: { select: { name: true } },
  services: { select: { serviceId: true, name: true, durationMin: true, price: true } },
} as const;

type BookingWithRelations = NonNullable<
  Awaited<ReturnType<typeof findByToken>>
>;

function findByToken(prisma: PrismaClient, token: string) {
  return prisma.booking.findUnique({ where: { manageToken: token }, include: bookingInclude });
}

export function toBookingView(booking: BookingWithRelations, settings: BookingSettings): BookingView {
  const beforeCutoff =
    booking.startsAt.getTime() - Date.now() >= settings.cancelCutoffMin * 60_000;
  const isActive = booking.status === "confirmed" && beforeCutoff;

  return {
    token: booking.manageToken,
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    timezone: settings.timezone,
    totalPrice: booking.totalPrice,
    totalDurationMin: booking.totalDurationMin,
    barber: booking.barber,
    services: booking.services,
    serviceIds: booking.services
      .map((service) => service.serviceId)
      .filter((id): id is string => id !== null),
    client: booking.client,
    canCancel: isActive,
    canReschedule: isActive,
    cancelCutoffMin: settings.cancelCutoffMin,
  };
}

type ClientInput = { name: string; phone: string };
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Для Telegram клиент определяется по telegram_id; телефон обновляется, только если он ничей.
 * Для сайта — по телефону.
 */
async function resolveClient(tx: Tx, input: ClientInput, telegramUser?: TelegramUser) {
  if (!telegramUser) {
    return tx.client.upsert({
      where: { phone: input.phone },
      update: { name: input.name },
      create: input,
    });
  }

  const telegramId = BigInt(telegramUser.id);
  const [byTelegram, byPhone] = await Promise.all([
    tx.client.findUnique({ where: { telegramId } }),
    tx.client.findUnique({ where: { phone: input.phone } }),
  ]);

  if (byTelegram) {
    const phoneIsFree = !byPhone || byPhone.id === byTelegram.id;
    return tx.client.update({
      where: { id: byTelegram.id },
      data: { name: input.name, ...(phoneIsFree ? { phone: input.phone } : {}) },
    });
  }
  if (byPhone) {
    return tx.client.update({
      where: { id: byPhone.id },
      data: { name: input.name, ...(byPhone.telegramId === null ? { telegramId } : {}) },
    });
  }
  return tx.client.create({ data: { ...input, telegramId } });
}

export async function createBooking(
  prisma: PrismaClient,
  input: {
    serviceIds: string[];
    barberId: string;
    startsAt: string;
    client: ClientInput;
  },
  options: ActorOptions & { telegramUser?: TelegramUser } = {},
): Promise<BookingView> {
  const { telegramUser, admin } = options;
  const context = await loadBookingContext(prisma, input);
  const startsAt = new Date(input.startsAt);
  const candidates = await resolveCandidates(prisma, context, startsAt, { admin });

  for (const barberId of candidates) {
    const barber = context.barbers.find((item) => item.id === barberId)!;
    try {
      const booking = await prisma.$transaction(async (tx) => {
        const client = await resolveClient(tx, input.client, telegramUser);
        return tx.booking.create({
          data: {
            clientId: client.id,
            barberId,
            startsAt,
            endsAt: new Date(startsAt.getTime() + barber.durationMin * 60_000),
            totalPrice: barber.price,
            totalDurationMin: barber.durationMin,
            source: admin ? "admin" : telegramUser ? "telegram" : "web",
            manageToken: randomBytes(24).toString("base64url"),
            ...reminderMarks(startsAt, new Date(), context.settings),
            services: {
              create: context.services.map((service) => ({
                serviceId: service.id,
                name: service.name,
                durationMin: service.durationMin,
                price: service.price,
              })),
            },
          },
          include: bookingInclude,
        });
      });
      return toBookingView(booking, context.settings);
    } catch (error) {
      if (!isExclusionViolation(error)) throw error;
      if (input.barberId !== ANY_BARBER) throw slotTaken();
    }
  }

  throw slotTaken();
}

async function getOwnBooking(prisma: PrismaClient, token: string) {
  const booking = await findByToken(prisma, token);
  if (!booking) throw notFound("BOOKING_NOT_FOUND", "Запись не найдена");
  return booking;
}

function assertManageable(booking: BookingWithRelations, settings: BookingSettings, options: ActorOptions = {}) {
  if (booking.status !== "confirmed") {
    throw new AppError(409, "BOOKING_NOT_ACTIVE", "Запись уже отменена или завершена");
  }
  if (options.admin) return;
  if (booking.startsAt.getTime() - Date.now() < settings.cancelCutoffMin * 60_000) {
    throw new AppError(
      422,
      "CANCEL_CUTOFF",
      `Изменить запись можно не позднее чем за ${settings.cancelCutoffMin} мин до начала`,
    );
  }
}

const PAST_BOOKINGS_LIMIT = 10;

export async function listTelegramBookings(prisma: PrismaClient, telegramUser: TelegramUser) {
  const where = { client: { telegramId: BigInt(telegramUser.id) } };
  const now = new Date();
  const [settings, upcoming, past] = await Promise.all([
    loadSettings(prisma),
    prisma.booking.findMany({
      where: { ...where, status: "confirmed", endsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      include: bookingInclude,
    }),
    prisma.booking.findMany({
      where: { ...where, NOT: { status: "confirmed", endsAt: { gt: now } } },
      orderBy: { startsAt: "desc" },
      take: PAST_BOOKINGS_LIMIT,
      include: bookingInclude,
    }),
  ]);

  return {
    upcoming: upcoming.map((booking) => toBookingView(booking, settings)),
    past: past.map((booking) => toBookingView(booking, settings)),
  };
}

export async function getBooking(prisma: PrismaClient, token: string): Promise<BookingView> {
  const [booking, settings] = await Promise.all([getOwnBooking(prisma, token), loadSettings(prisma)]);
  return toBookingView(booking, settings);
}

export async function cancelBooking(
  prisma: PrismaClient,
  token: string,
  options: ActorOptions = {},
): Promise<BookingView> {
  const [booking, settings] = await Promise.all([getOwnBooking(prisma, token), loadSettings(prisma)]);
  assertManageable(booking, settings, options);

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled" },
    include: bookingInclude,
  });
  return toBookingView(updated, settings);
}

export async function rescheduleBooking(
  prisma: PrismaClient,
  token: string,
  startsAtIso: string,
  options: ActorOptions = {},
): Promise<{ booking: BookingView; previous: { startsAt: Date; endsAt: Date } }> {
  const booking = await getOwnBooking(prisma, token);
  const serviceIds = booking.services
    .map((service) => service.serviceId)
    .filter((id): id is string => id !== null);
  const context = await loadBookingContext(prisma, { serviceIds, barberId: booking.barberId });
  assertManageable(booking, context.settings, options);

  const startsAt = new Date(startsAtIso);
  await resolveCandidates(prisma, context, startsAt, { excludeBookingId: booking.id, admin: options.admin });

  try {
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        startsAt,
        endsAt: new Date(startsAt.getTime() + booking.totalDurationMin * 60_000),
        ...reminderMarks(startsAt, new Date(), context.settings),
      },
      include: bookingInclude,
    });
    return {
      booking: toBookingView(updated, context.settings),
      previous: { startsAt: booking.startsAt, endsAt: booking.endsAt },
    };
  } catch (error) {
    if (isExclusionViolation(error)) throw slotTaken();
    throw error;
  }
}
