import {
  addDays,
  daysBetween,
  getWeekday,
  toZoned,
  zonedToUtc,
  type AnalyticsCancellations,
  type AnalyticsHeatmap,
  type AnalyticsLoad,
  type AnalyticsRetention,
  type AnalyticsRevenue,
  type AnalyticsServices,
  type AnalyticsStatusCounts,
} from "@barbershop/shared";

export type AnalyticsBooking = {
  clientId: string;
  barberId: string;
  startsAt: Date;
  status: keyof AnalyticsStatusCounts;
  source: "web" | "telegram" | "admin";
  totalPrice: number;
  totalDurationMin: number;
  services: { serviceId: string | null; name: string; price: number }[];
};

type ScheduleItem = { weekday: number; startMin: number; endMin: number };

export type AnalyticsBarber = { id: string; name: string; workingHours: ScheduleItem[]; breaks: ScheduleItem[] };
export type AnalyticsTimeOff = { barberId: string | null; startsAt: Date; endsAt: Date };
export type Period = { from: string; to: string; timezone: string };

const MINUTE = 60_000;
const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
/** Занимает ли запись время мастера: отменённая — нет, неявка — да (слот был заблокирован). */
const occupies = (booking: AnalyticsBooking) => booking.status !== "cancelled";

export function periodBounds({ from, to, timezone }: Period) {
  return { start: zonedToUtc(from, 0, timezone), end: zonedToUtc(addDays(to, 1), 0, timezone) };
}

export function periodDays({ from, to }: Pick<Period, "from" | "to">) {
  return Array.from({ length: daysBetween(from, to) + 1 }, (_, index) => addDays(from, index));
}

export function previousPeriod({ from, to }: Pick<Period, "from" | "to">) {
  const length = daysBetween(from, to) + 1;
  return { from: addDays(from, -length), to: addDays(from, -1) };
}

const emptyStatuses = (): AnalyticsStatusCounts => ({ confirmed: 0, completed: 0, cancelled: 0, no_show: 0 });

export function computeRevenue(
  bookings: AnalyticsBooking[],
  previousBookings: AnalyticsBooking[],
  period: Period,
): AnalyticsRevenue {
  const days = new Map(periodDays(period).map((date) => [date, { date, revenue: 0, completed: 0, bookings: 0 }]));
  const byStatus = emptyStatuses();
  const bySource = { web: 0, telegram: 0, admin: 0 };
  let revenue = 0;

  for (const booking of bookings) {
    byStatus[booking.status] += 1;
    bySource[booking.source] += 1;
    const day = days.get(toZoned(booking.startsAt, period.timezone).date);
    if (day) day.bookings += 1;
    if (booking.status !== "completed") continue;
    revenue += booking.totalPrice;
    if (day) {
      day.revenue += booking.totalPrice;
      day.completed += 1;
    }
  }

  const previousCompleted = previousBookings.filter((booking) => booking.status === "completed");
  return {
    revenue,
    completed: byStatus.completed,
    averageCheck: Math.round(ratio(revenue, byStatus.completed)),
    bookings: { total: bookings.length, byStatus, bySource },
    previous: {
      ...previousPeriod(period),
      revenue: previousCompleted.reduce((sum, booking) => sum + booking.totalPrice, 0),
      completed: previousCompleted.length,
      bookings: previousBookings.length,
    },
    days: [...days.values()],
  };
}

export function computeServices(bookings: AnalyticsBooking[]): AnalyticsServices {
  const services = new Map<string, AnalyticsServices["services"][number]>();
  for (const booking of bookings.filter(occupies)) {
    for (const item of booking.services) {
      // Удалённая услуга остаётся в истории по снимку названия.
      const key = item.serviceId ?? `name:${item.name}`;
      const entry = services.get(key) ?? { key, name: item.name, bookings: 0, completed: 0, revenue: 0 };
      entry.bookings += 1;
      if (booking.status === "completed") {
        entry.completed += 1;
        entry.revenue += item.price;
      }
      services.set(key, entry);
    }
  }
  return {
    services: [...services.values()].sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue),
  };
}

type Interval = [number, number];

/** Вычитает из интервалов набор «вырезов», возвращает оставшиеся куски. */
function subtract(intervals: Interval[], cuts: Interval[]): Interval[] {
  return cuts.reduce<Interval[]>(
    (rest, [cutStart, cutEnd]) =>
      rest.flatMap(([start, end]) => {
        if (cutEnd <= start || cutStart >= end) return [[start, end]];
        const pieces: Interval[] = [];
        if (cutStart > start) pieces.push([start, cutStart]);
        if (cutEnd < end) pieces.push([cutEnd, end]);
        return pieces;
      }),
    intervals,
  );
}

export function availableMinutes(barber: AnalyticsBarber, timeOff: AnalyticsTimeOff[], period: Period) {
  const cuts: Interval[] = timeOff
    .filter((item) => item.barberId === null || item.barberId === barber.id)
    .map((item) => [item.startsAt.getTime(), item.endsAt.getTime()]);
  let total = 0;
  for (const date of periodDays(period)) {
    const weekday = getWeekday(date);
    const at = (minutes: number) => zonedToUtc(date, minutes, period.timezone).getTime();
    const working: Interval[] = barber.workingHours
      .filter((item) => item.weekday === weekday)
      .map((item) => [at(item.startMin), at(item.endMin)]);
    const breaks: Interval[] = barber.breaks
      .filter((item) => item.weekday === weekday)
      .map((item) => [at(item.startMin), at(item.endMin)]);
    total += subtract(subtract(working, breaks), cuts).reduce((sum, [start, end]) => sum + (end - start) / MINUTE, 0);
  }
  return Math.round(total);
}

export function computeLoad(
  bookings: AnalyticsBooking[],
  barbers: AnalyticsBarber[],
  timeOff: AnalyticsTimeOff[],
  period: Period,
): AnalyticsLoad {
  return {
    barbers: barbers.map((barber) => {
      const own = bookings.filter((booking) => booking.barberId === barber.id && occupies(booking));
      const availableMin = availableMinutes(barber, timeOff, period);
      const bookedMin = own.reduce((sum, booking) => sum + booking.totalDurationMin, 0);
      return {
        barberId: barber.id,
        name: barber.name,
        availableMin,
        bookedMin,
        utilization: availableMin > 0 ? Math.min(bookedMin / availableMin, 1) : null,
        bookings: own.length,
        revenue: own.filter((booking) => booking.status === "completed").reduce((sum, booking) => sum + booking.totalPrice, 0),
      };
    }),
  };
}

const grid = () => Array.from({ length: 7 }, () => Array<number>(24).fill(0));

export function computeHeatmap(bookings: AnalyticsBooking[], period: Period): AnalyticsHeatmap {
  const minutes = grid();
  const starts = grid();
  for (const booking of bookings.filter(occupies)) {
    const local = toZoned(booking.startsAt, period.timezone);
    const weekday = getWeekday(local.date);
    starts[weekday][Math.floor(local.minutes / 60)] += 1;
    // Раскладываем длительность по часам: 13:30–14:30 даёт 30 минут в 13 и 30 в 14.
    let cursor = local.minutes;
    const end = Math.min(local.minutes + booking.totalDurationMin, 24 * 60);
    while (cursor < end) {
      const hour = Math.floor(cursor / 60);
      const next = Math.min((hour + 1) * 60, end);
      minutes[weekday][hour] += next - cursor;
      cursor = next;
    }
  }
  const weekdayCount = Array<number>(7).fill(0);
  for (const date of periodDays(period)) weekdayCount[getWeekday(date)] += 1;
  return { minutes, starts, weekdayCount };
}

export function computeCancellations(
  bookings: AnalyticsBooking[],
  barbers: Pick<AnalyticsBarber, "id" | "name">[],
): AnalyticsCancellations {
  const count = (items: AnalyticsBooking[], status: AnalyticsBooking["status"]) =>
    items.filter((booking) => booking.status === status).length;
  const cancelled = count(bookings, "cancelled");
  const noShow = count(bookings, "no_show");
  const completed = count(bookings, "completed");
  return {
    total: bookings.length,
    cancelled,
    cancelRate: ratio(cancelled, bookings.length),
    noShow,
    noShowRate: ratio(noShow, completed + noShow),
    barbers: barbers.map((barber) => {
      const own = bookings.filter((booking) => booking.barberId === barber.id);
      return {
        barberId: barber.id,
        name: barber.name,
        total: own.length,
        cancelled: count(own, "cancelled"),
        noShow: count(own, "no_show"),
        completed: count(own, "completed"),
      };
    }),
  };
}

/** priorClientIds — клиенты, у которых есть completed-визит до начала периода. */
export function computeRetention(bookings: AnalyticsBooking[], priorClientIds: Set<string>): AnalyticsRetention {
  const visits = new Map<string, number>();
  for (const booking of bookings) {
    if (booking.status === "completed") visits.set(booking.clientId, (visits.get(booking.clientId) ?? 0) + 1);
  }
  const clients = visits.size;
  const returningClients = [...visits.keys()].filter((id) => priorClientIds.has(id)).length;
  const newRepeated = [...visits].filter(([id, count]) => !priorClientIds.has(id) && count >= 2).length;
  return {
    clients,
    newClients: clients - returningClients,
    returningClients,
    returningRate: ratio(returningClients, clients),
    newRepeated,
  };
}
