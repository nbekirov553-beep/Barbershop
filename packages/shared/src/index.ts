import { z } from "zod";

export * from "./time.js";
export * from "./admin.js";
export * from "./analytics.js";

const time = z.string().regex(/^\d{2}:\d{2}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD");

export const ANY_BARBER = "any";

export const serviceCategorySchema = z.enum(["hair", "beard"]);

export const serviceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  category: serviceCategorySchema,
  durationMin: z.number().int().positive(),
  price: z.number().int().nonnegative(),
});

export const barberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  bio: z.string(),
  experienceYears: z.number().int().nonnegative(),
  specialties: z.array(z.string()),
  rating: z.number().nullable(),
  reviewsCount: z.number().int().nonnegative(),
  /** 0 = воскресенье ... 6 = суббота. */
  workdays: z.array(z.number().int().min(0).max(6)),
});

const scheduleItemSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: time,
  endTime: time,
});

export const barberDetailSchema = barberSchema.extend({
  services: z.array(serviceSchema),
  workingHours: z.array(scheduleItemSchema),
  breaks: z.array(scheduleItemSchema),
});

export const reviewSchema = z.object({
  id: z.uuid(),
  author: z.string(),
  barberId: z.uuid(),
  barberName: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  date: z.iso.datetime(),
});

export const barberParamsSchema = z.object({
  id: z.uuid({ error: "Некорректный id мастера" }),
});

/** serviceIds в query: ?serviceIds=a,b или ?serviceIds=a&serviceIds=b. */
const serviceIdsQuery = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : value.split(",")).filter(Boolean))
  .pipe(z.array(z.uuid({ error: "Некорректный id услуги" })).min(1, "Выберите хотя бы одну услугу"));

const barberIdOrAny = z.union([z.literal(ANY_BARBER), z.uuid({ error: "Некорректный id мастера" })]);

/** manage_token переносимой записи: её собственное время не считается занятым. */
const excludeToken = z.string().min(16).max(128).optional();

export const availabilityQuerySchema = z.object({
  serviceIds: serviceIdsQuery,
  barberId: barberIdOrAny.default(ANY_BARBER),
  date: isoDate,
  excludeToken,
});

export const availabilityDaysQuerySchema = z.object({
  serviceIds: serviceIdsQuery,
  barberId: barberIdOrAny.default(ANY_BARBER),
  excludeToken,
});

export const availabilitySchema = z.object({
  date: isoDate,
  timezone: z.string(),
  durationMin: z.number().int(),
  price: z.number().int(),
  slots: z.array(time),
});

export const availabilityDaysSchema = z.object({
  timezone: z.string(),
  today: isoDate,
  days: z.array(z.object({ date: isoDate, available: z.boolean() })),
});

const phone = z
  .string()
  .transform((value) => value.replace(/[^\d+]/g, ""))
  .pipe(z.string().regex(/^\+998\d{9}$/, "Телефон в формате +998XXXXXXXXX"));

export const createBookingSchema = z.object({
  serviceIds: z
    .array(z.uuid({ error: "Некорректный id услуги" }))
    .min(1, "Выберите хотя бы одну услугу")
    .max(5)
    .refine((ids) => new Set(ids).size === ids.length, "Услуги не должны повторяться"),
  barberId: barberIdOrAny,
  startsAt: z.iso.datetime({ offset: true, error: "startsAt должен быть ISO-датой" }),
  client: z.object({
    name: z.string().trim().min(2, "Введите имя, минимум 2 буквы").max(60),
    phone,
  }),
});

export const rescheduleBookingSchema = z.object({
  startsAt: z.iso.datetime({ offset: true, error: "startsAt должен быть ISO-датой" }),
});

export const bookingTokenParamsSchema = z.object({
  token: z.string().min(16).max(128),
});

export const bookingStatusSchema = z.enum(["confirmed", "completed", "cancelled", "no_show"]);

export const bookingViewSchema = z.object({
  token: z.string(),
  status: bookingStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  timezone: z.string(),
  totalPrice: z.number().int(),
  totalDurationMin: z.number().int(),
  barber: z.object({ id: z.uuid(), name: z.string() }),
  services: z.array(
    z.object({ serviceId: z.uuid().nullable(), name: z.string(), durationMin: z.number().int(), price: z.number().int() }),
  ),
  serviceIds: z.array(z.uuid()),
  client: z.object({ name: z.string() }),
  canCancel: z.boolean(),
  canReschedule: z.boolean(),
  cancelCutoffMin: z.number().int(),
});

export const meSchema = z.object({
  telegramUser: z.object({
    id: z.number().int(),
    firstName: z.string(),
    lastName: z.string().optional(),
    username: z.string().optional(),
  }),
  /** null — клиент ещё ни разу не записывался из Telegram. */
  client: z.object({ name: z.string(), phone: z.string() }).nullable(),
});

export const myBookingsSchema = z.object({
  upcoming: z.array(bookingViewSchema),
  past: z.array(bookingViewSchema),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ServiceCategory = z.infer<typeof serviceCategorySchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Barber = z.infer<typeof barberSchema>;
export type BarberDetail = z.infer<typeof barberDetailSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type AvailabilityDays = z.infer<typeof availabilityDaysSchema>;
export type CreateBookingInput = z.input<typeof createBookingSchema>;
export type BookingView = z.infer<typeof bookingViewSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type Me = z.infer<typeof meSchema>;
export type MyBookings = z.infer<typeof myBookingsSchema>;
