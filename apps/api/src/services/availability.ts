import type { PrismaClient } from "@barbershop/db";
import {
  ANY_BARBER,
  addDays,
  daysBetween,
  getWeekday,
  toZoned,
  zonedToUtc,
} from "@barbershop/shared";
import { computeDaySlots, type Interval } from "../domain/slots.js";
import { loadSettings, type BookingSettings } from "../domain/settings.js";
import { AppError, notFound } from "../errors.js";

const timeOfDay = (value: Date) => value.getUTCHours() * 60 + value.getUTCMinutes();

export type EligibleBarber = {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  workingHours: Map<number, Interval>;
  breaks: Map<number, Interval[]>;
};

export type BookingContext = {
  settings: BookingSettings;
  now: Date;
  today: string;
  services: { id: string; name: string; durationMin: number; price: number }[];
  barbers: EligibleBarber[];
  /** Длительность и цена по базовому прайсу: для «любого мастера» и ответа /availability. */
  durationMin: number;
  price: number;
};

/** Загружает услуги и мастеров, которые оказывают все выбранные услуги. */
export async function loadBookingContext(
  prisma: PrismaClient,
  params: { serviceIds: string[]; barberId: string },
): Promise<BookingContext> {
  const [settings, services] = await Promise.all([
    loadSettings(prisma),
    prisma.service.findMany({
      where: { id: { in: params.serviceIds }, isActive: true },
      select: { id: true, name: true, durationMin: true, price: true },
    }),
  ]);

  if (services.length !== new Set(params.serviceIds).size) {
    throw new AppError(422, "INVALID_SERVICES", "Одна или несколько услуг недоступны");
  }

  const barbers = await prisma.barber.findMany({
    where: { isActive: true, ...(params.barberId !== ANY_BARBER && { id: params.barberId }) },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      services: {
        where: { serviceId: { in: params.serviceIds }, isEnabled: true },
        select: { serviceId: true, durationMin: true, price: true },
      },
      workingHours: { select: { weekday: true, startTime: true, endTime: true } },
      breaks: { select: { weekday: true, startTime: true, endTime: true } },
    },
  });

  if (params.barberId !== ANY_BARBER && barbers.length === 0) {
    throw notFound("BARBER_NOT_FOUND", "Мастер не найден");
  }

  const eligible = barbers
    .filter((barber) => barber.services.length === services.length)
    .map((barber): EligibleBarber => {
      const overrides = new Map(barber.services.map((item) => [item.serviceId, item]));
      const breaks = new Map<number, Interval[]>();
      for (const item of barber.breaks) {
        breaks.set(item.weekday, [
          ...(breaks.get(item.weekday) ?? []),
          { start: timeOfDay(item.startTime), end: timeOfDay(item.endTime) },
        ]);
      }
      return {
        id: barber.id,
        name: barber.name,
        durationMin: services.reduce(
          (sum, service) => sum + (overrides.get(service.id)?.durationMin ?? service.durationMin),
          0,
        ),
        price: services.reduce(
          (sum, service) => sum + (overrides.get(service.id)?.price ?? service.price),
          0,
        ),
        workingHours: new Map(
          barber.workingHours.map((item) => [
            item.weekday,
            { start: timeOfDay(item.startTime), end: timeOfDay(item.endTime) },
          ]),
        ),
        breaks,
      };
    });

  if (params.barberId !== ANY_BARBER && eligible.length === 0) {
    throw new AppError(422, "SERVICE_NOT_PROVIDED", "Мастер не оказывает выбранные услуги");
  }

  const now = new Date();
  return {
    settings,
    now,
    today: toZoned(now, settings.timezone).date,
    services,
    barbers: eligible,
    durationMin: services.reduce((sum, service) => sum + service.durationMin, 0),
    price: services.reduce((sum, service) => sum + service.price, 0),
  };
}

export function isWithinHorizon(context: BookingContext, date: string): boolean {
  const offset = daysBetween(context.today, date);
  return offset >= 0 && offset < context.settings.bookingHorizonDays;
}

type ComputeOptions = {
  from: string;
  to: string;
  /** Перенос: собственная запись не должна блокировать новое время. */
  excludeBookingId?: string;
  /** Без учёта записей: чтобы отличить «занято» от «вне рабочего времени». */
  ignoreBookings?: boolean;
  /** Админ записывает без min_notice и горизонта записи, но не в прошлое. */
  admin?: boolean;
};

/** date -> barberId -> минуты начала свободных слотов. */
export type AvailabilityMap = Map<string, Map<string, number[]>>;

export async function computeAvailability(
  prisma: PrismaClient,
  context: BookingContext,
  options: ComputeOptions,
): Promise<AvailabilityMap> {
  const { settings, barbers } = context;
  const tz = settings.timezone;
  const barberIds = barbers.map((barber) => barber.id);
  const rangeStart = zonedToUtc(options.from, 0, tz);
  const rangeEnd = zonedToUtc(addDays(options.to, 1), 0, tz);

  const [timeOff, bookings] = await Promise.all([
    prisma.timeOff.findMany({
      where: {
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        OR: [{ barberId: null }, { barberId: { in: barberIds } }],
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
    options.ignoreBookings
      ? Promise.resolve([])
      : prisma.booking.findMany({
          where: {
            status: "confirmed",
            barberId: { in: barberIds },
            startsAt: { lt: rangeEnd },
            endsAt: { gt: rangeStart },
            ...(options.excludeBookingId && { id: { not: options.excludeBookingId } }),
          },
          select: { barberId: true, startsAt: true, endsAt: true },
        }),
  ]);

  const earliestInstant = context.now.getTime() + (options.admin ? 0 : settings.minNoticeMin * 60_000);
  const result: AvailabilityMap = new Map();

  for (let date = options.from; date <= options.to; date = addDays(date, 1)) {
    const perBarber = new Map<string, number[]>();
    result.set(date, perBarber);
    if (!options.admin && !isWithinHorizon(context, date)) continue;

    const dayStart = zonedToUtc(date, 0, tz).getTime();
    const toDayMinutes = (instant: Date) => Math.round((instant.getTime() - dayStart) / 60_000);
    const weekday = getWeekday(date);

    for (const barber of barbers) {
      const busy = [
        ...timeOff.filter((item) => item.barberId === null || item.barberId === barber.id),
        ...bookings.filter((item) => item.barberId === barber.id),
      ].map((item) => ({ start: toDayMinutes(item.startsAt), end: toDayMinutes(item.endsAt) }));

      perBarber.set(
        barber.id,
        computeDaySlots({
          workingHours: barber.workingHours.get(weekday) ?? null,
          breaks: barber.breaks.get(weekday) ?? [],
          busy,
          durationMin: barber.durationMin,
          stepMin: settings.slotStepMin,
          earliestStart: Math.ceil((earliestInstant - dayStart) / 60_000),
        }),
      );
    }
  }

  return result;
}

/** Объединённый отсортированный список стартов для всех мастеров на дату. */
export function mergeSlots(perBarber: Map<string, number[]> | undefined): number[] {
  if (!perBarber) return [];
  return [...new Set([...perBarber.values()].flat())].sort((a, b) => a - b);
}
