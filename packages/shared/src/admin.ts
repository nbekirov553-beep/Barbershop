import { z } from "zod";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Время в формате ЧЧ:ММ");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD");
/** Локальное время салона без смещения: 2026-10-09T14:30. */
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Дата и время в формате YYYY-MM-DDTHH:MM");
const uuid = z.uuid({ error: "Некорректный id" });
const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

export const adminLoginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1, "Введите логин").max(64),
  password: z.string().min(1, "Введите пароль").max(256),
});

export const adminMeSchema = z.object({ login: z.string() });

/* ---------- Записи ---------- */

export const adminBookingStatusSchema = z.enum(["confirmed", "completed", "cancelled", "no_show"]);
export const bookingSourceSchema = z.enum(["web", "telegram", "admin"]);

export const adminBookingsQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  barberId: uuid.optional(),
  status: adminBookingStatusSchema.optional(),
});

export const adminBookingSchema = z.object({
  id: z.uuid(),
  token: z.string(),
  status: adminBookingStatusSchema,
  source: bookingSourceSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  totalPrice: z.number().int(),
  totalDurationMin: z.number().int(),
  barber: z.object({ id: z.uuid(), name: z.string() }),
  client: z.object({ name: z.string(), phone: z.string(), hasTelegram: z.boolean() }),
  services: z.array(z.string()),
  serviceIds: z.array(z.uuid()),
  autoCompleted: z.boolean(),
});

export const adminAvailabilityQuerySchema = z.object({
  serviceIds: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : value.split(",")).filter(Boolean))
    .pipe(z.array(uuid).min(1, "Выберите хотя бы одну услугу")),
  barberId: uuid,
  date: isoDate,
  /** id переносимой записи: её время не считается занятым. */
  excludeId: uuid.optional(),
});

const phone = z
  .string()
  .transform((value) => value.replace(/[^\d+]/g, ""))
  .pipe(z.string().regex(/^\+998\d{9}$/, "Телефон в формате +998XXXXXXXXX"));

export const adminCreateBookingSchema = z.object({
  serviceIds: z.array(uuid).min(1, "Выберите хотя бы одну услугу").max(5),
  barberId: uuid,
  startsAt: z.iso.datetime({ offset: true }),
  client: z.object({
    name: z.string().trim().min(2, "Имя — минимум 2 буквы").max(60),
    phone,
  }),
});

/** Либо смена статуса, либо перенос. Вернуть отменённую запись нельзя: слот мог занять другой клиент. */
export const adminUpdateBookingSchema = z.union([
  z.object({ status: z.enum(["completed", "cancelled", "no_show"]) }),
  z.object({ startsAt: z.iso.datetime({ offset: true }) }),
]);

/* ---------- Услуги ---------- */

export const adminServiceInputSchema = z.object({
  name: z.string().trim().min(2, "Название — минимум 2 символа").max(80),
  description: z.string().trim().max(300).default(""),
  category: z.enum(["hair", "beard"]),
  durationMin: z.number().int().min(5, "Минимум 5 минут").max(480),
  price: z.number().int().min(0).max(100_000_000),
  isActive: z.boolean().default(true),
});

export const adminServicePatchSchema = adminServiceInputSchema.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
});

export const adminServiceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["hair", "beard"]),
  durationMin: z.number().int(),
  price: z.number().int(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

/* ---------- Барберы ---------- */

/** /images/... из public или https-ссылка (Supabase Storage). */
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value.startsWith("/") || value.startsWith("https://"), "Нужна ссылка https:// или путь /images/...");

export const adminBarberInputSchema = z.object({
  name: z.string().trim().min(2, "Имя — минимум 2 буквы").max(60),
  bio: z.string().trim().max(500).default(""),
  experienceYears: z.number().int().min(0).max(60).default(0),
  specialties: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  photoUrl: imageUrl.nullable().default(null),
  isActive: z.boolean().default(true),
});

export const adminBarberPatchSchema = adminBarberInputSchema.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
});

const scheduleItemSchema = z
  .object({ weekday: z.number().int().min(0).max(6), startTime: time, endTime: time })
  .refine((item) => toMinutes(item.startTime) < toMinutes(item.endTime), "Начало должно быть раньше конца");

export const adminScheduleSchema = z
  .object({
    workingHours: z.array(scheduleItemSchema).max(7),
    breaks: z.array(scheduleItemSchema).max(21),
  })
  .superRefine((value, ctx) => {
    const days = value.workingHours.map((item) => item.weekday);
    if (new Set(days).size !== days.length) {
      ctx.addIssue({ code: "custom", message: "Один рабочий интервал на день", path: ["workingHours"] });
    }
    for (const item of value.breaks) {
      const day = value.workingHours.find((hours) => hours.weekday === item.weekday);
      const inside =
        day &&
        toMinutes(item.startTime) >= toMinutes(day.startTime) &&
        toMinutes(item.endTime) <= toMinutes(day.endTime);
      if (!inside) {
        ctx.addIssue({ code: "custom", message: "Обед должен быть внутри рабочего дня", path: ["breaks"] });
        return;
      }
    }
  });

export const adminBarberServicesSchema = z.array(
  z.object({
    serviceId: uuid,
    isEnabled: z.boolean(),
    durationMin: z.number().int().min(5).max(480).nullable(),
    price: z.number().int().min(0).max(100_000_000).nullable(),
  }),
);

export const adminPortfolioInputSchema = z.object({ imageUrl });

export const adminBarberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  bio: z.string(),
  experienceYears: z.number().int(),
  specialties: z.array(z.string()),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  telegramLinked: z.boolean(),
  services: z.array(
    z.object({
      serviceId: z.uuid(),
      isEnabled: z.boolean(),
      durationMin: z.number().int().nullable(),
      price: z.number().int().nullable(),
    }),
  ),
  workingHours: z.array(z.object({ weekday: z.number().int(), startTime: time, endTime: time })),
  breaks: z.array(z.object({ weekday: z.number().int(), startTime: time, endTime: time })),
  portfolio: z.array(z.object({ id: z.uuid(), imageUrl: z.string() })),
});

/* ---------- Исключения ---------- */

export const timeOffTypeSchema = z.enum(["day_off", "vacation", "sick_leave", "holiday"]);

export const adminTimeOffInputSchema = z
  .object({
    barberId: uuid.nullable(),
    type: timeOffTypeSchema,
    note: z.string().trim().max(200).nullable().default(null),
    from: localDateTime,
    to: localDateTime,
  })
  .refine((value) => value.from < value.to, { message: "Конец должен быть позже начала", path: ["to"] });

export const adminTimeOffQuerySchema = z.object({ from: isoDate.optional() });

export const adminTimeOffSchema = z.object({
  id: z.uuid(),
  barberId: z.uuid().nullable(),
  barberName: z.string().nullable(),
  type: timeOffTypeSchema,
  note: z.string().nullable(),
  from: localDateTime,
  to: localDateTime,
  /** Активные записи, попадающие в интервал: их нужно перенести или отменить вручную. */
  conflicts: z.number().int(),
});

/* ---------- Отзывы и настройки ---------- */

export const adminReviewSchema = z.object({
  id: z.uuid(),
  rating: z.number().int(),
  comment: z.string().nullable(),
  isPublic: z.boolean(),
  createdAt: z.iso.datetime(),
  visitAt: z.iso.datetime(),
  barberName: z.string(),
  clientName: z.string(),
});

export const adminReviewPatchSchema = z.object({ isPublic: z.boolean() });

const minutes = (max: number) => z.number().int().min(1).max(max);

export const adminSettingsInputSchema = z.object({
  cancelCutoffMin: z.number().int().min(0).max(24 * 60),
  slotStepMin: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
  bookingHorizonDays: z.number().int().min(1).max(180),
  minNoticeMin: z.number().int().min(0).max(24 * 60),
  reminderDayMin: minutes(3 * 24 * 60),
  reminderShortMin: minutes(6 * 60),
  reviewDelayMin: minutes(7 * 24 * 60),
  reviewPublicMinRating: z.number().int().min(1).max(5),
});

export const adminSettingsSchema = adminSettingsInputSchema.extend({ timezone: z.string() });

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminMe = z.infer<typeof adminMeSchema>;
export type AdminBooking = z.infer<typeof adminBookingSchema>;
export type AdminBookingStatus = z.infer<typeof adminBookingStatusSchema>;
export type BookingSource = z.infer<typeof bookingSourceSchema>;
export type AdminCreateBookingInput = z.input<typeof adminCreateBookingSchema>;
export type AdminUpdateBookingInput = z.infer<typeof adminUpdateBookingSchema>;
export type AdminService = z.infer<typeof adminServiceSchema>;
export type AdminServiceInput = z.input<typeof adminServiceInputSchema>;
export type AdminBarber = z.infer<typeof adminBarberSchema>;
export type AdminBarberInput = z.input<typeof adminBarberInputSchema>;
export type AdminSchedule = z.infer<typeof adminScheduleSchema>;
export type AdminBarberServices = z.infer<typeof adminBarberServicesSchema>;
export type TimeOffType = z.infer<typeof timeOffTypeSchema>;
export type AdminTimeOff = z.infer<typeof adminTimeOffSchema>;
export type AdminTimeOffInput = z.input<typeof adminTimeOffInputSchema>;
export type AdminReview = z.infer<typeof adminReviewSchema>;
export type AdminSettings = z.infer<typeof adminSettingsSchema>;
export type AdminSettingsInput = z.infer<typeof adminSettingsInputSchema>;
