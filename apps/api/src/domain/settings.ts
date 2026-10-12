import type { PrismaClient } from "@barbershop/db";
import { notificationDefaults } from "@barbershop/notifications";

export type BookingSettings = {
  timezone: string;
  slotStepMin: number;
  bookingHorizonDays: number;
  minNoticeMin: number;
  cancelCutoffMin: number;
  reminderDayMin: number;
  reminderShortMin: number;
  reviewDelayMin: number;
  reviewPublicMinRating: number;
};

/** Ключи таблицы settings для полей BookingSettings (кроме timezone). */
export const settingKeys = {
  slotStepMin: "slot_step_min",
  bookingHorizonDays: "booking_horizon_days",
  minNoticeMin: "min_notice_min",
  cancelCutoffMin: "cancel_cutoff_min",
  reminderDayMin: "reminder_day_minutes",
  reminderShortMin: "reminder_short_minutes",
  reviewDelayMin: "review_delay_min",
  reviewPublicMinRating: "review_public_min_rating",
} as const satisfies Record<Exclude<keyof BookingSettings, "timezone">, string>;

const defaults: BookingSettings = {
  timezone: notificationDefaults.timezone,
  slotStepMin: 15,
  bookingHorizonDays: 30,
  minNoticeMin: 30,
  cancelCutoffMin: 30,
  reminderDayMin: notificationDefaults.reminderDayMin,
  reminderShortMin: notificationDefaults.reminderShortMin,
  reviewDelayMin: notificationDefaults.reviewDelayMin,
  reviewPublicMinRating: 4,
};

/** min_notice_min и cancel_cutoff_min могут быть 0; остальные значения — строго положительные. */
const zeroAllowed = new Set<string>([settingKeys.minNoticeMin, settingKeys.cancelCutoffMin]);

const toNumber = (key: string, value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  const min = zeroAllowed.has(key) ? 0 : 1;
  return value !== undefined && Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

export async function loadSettings(prisma: PrismaClient): Promise<BookingSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const numbers = Object.fromEntries(
    Object.entries(settingKeys).map(([field, key]) => [
      field,
      toNumber(key, map.get(key), defaults[field as keyof typeof settingKeys]),
    ]),
  ) as Omit<BookingSettings, "timezone">;

  return { timezone: map.get("timezone") || defaults.timezone, ...numbers };
}
