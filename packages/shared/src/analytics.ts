import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD");
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

export const ANALYTICS_MAX_DAYS = 366;

/** Период — локальные даты салона включительно, запись попадает в период по времени начала. */
export const analyticsQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    barberId: z.uuid({ error: "Некорректный id мастера" }).optional(),
  })
  .refine((value) => value.from <= value.to, { message: "Конец периода раньше начала", path: ["to"] })
  .refine((value) => dayNumber(value.to) - dayNumber(value.from) < ANALYTICS_MAX_DAYS, {
    message: `Период — не больше ${ANALYTICS_MAX_DAYS} дней`,
    path: ["to"],
  });

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export type AnalyticsStatusCounts = { confirmed: number; completed: number; cancelled: number; no_show: number };

export type AnalyticsRevenue = {
  /** Сумма completed-записей. */
  revenue: number;
  completed: number;
  /** revenue / completed, 0 если визитов нет. */
  averageCheck: number;
  /** Все записи периода по статусам и источникам. */
  bookings: { total: number; byStatus: AnalyticsStatusCounts; bySource: { web: number; telegram: number; admin: number } };
  /** Тот же показатель за предыдущий период такой же длины. */
  previous: { revenue: number; completed: number; bookings: number; from: string; to: string };
  days: { date: string; revenue: number; completed: number; bookings: number }[];
};

export type AnalyticsServices = {
  /** Отменённые записи не учитываются, выручка — только по completed. */
  services: { key: string; name: string; bookings: number; completed: number; revenue: number }[];
};

export type AnalyticsLoad = {
  barbers: {
    barberId: string;
    name: string;
    /** Минуты по графику минус обеды и исключения. */
    availableMin: number;
    /** Минуты записей confirmed, completed и no_show. */
    bookedMin: number;
    /** bookedMin / availableMin, 0..1; null если мастер не работал. */
    utilization: number | null;
    bookings: number;
    revenue: number;
  }[];
};

export type AnalyticsHeatmap = {
  /** cells[weekday][hour]: занятые минуты, weekday 0 = воскресенье. */
  minutes: number[][];
  /** Сколько записей начинается в этот час. */
  starts: number[][];
  /** Сколько раз каждый день недели встречается в периоде: для средних. */
  weekdayCount: number[];
};

export type AnalyticsCancellations = {
  total: number;
  cancelled: number;
  /** cancelled / total. */
  cancelRate: number;
  noShow: number;
  /** no_show / (completed + no_show): доля прошедших визитов, на которые не пришли. */
  noShowRate: number;
  barbers: { barberId: string; name: string; total: number; cancelled: number; noShow: number; completed: number }[];
};

export type AnalyticsRetention = {
  /** Клиенты, у которых в периоде есть completed-визит. */
  clients: number;
  /** Первый в жизни completed-визит пришёлся на период. */
  newClients: number;
  /** Были completed-визиты до начала периода. */
  returningClients: number;
  /** returningClients / clients. */
  returningRate: number;
  /** Новые клиенты, пришедшие в периоде два раза и больше. */
  newRepeated: number;
};
