import type { Barber, Service } from "@barbershop/shared";
import { formatDateLong } from "@barbershop/shared/format";
import { addDays, fromMinutes, toMinutes, toZoned } from "@barbershop/shared/time";

export { addDays, getWeekday } from "@barbershop/shared/time";

export const ANY_BARBER = "any";
export const BOOKING_HORIZON_DAYS = 30;
export const TIMEZONE = "Asia/Tashkent";

export const getTashkentToday = () => toZoned(new Date(), TIMEZONE).date;

export { formatDateLong, formatMonth, getDayOfMonth } from "@barbershop/shared/format";

export function getDayLabel(date: string): string {
  const today = getTashkentToday();
  if (date === today) return "Сегодня";
  if (date === addDays(today, 1)) return "Завтра";
  return formatDateLong(date);
}

export const findBarber = (barbers: Barber[], id: string | null) =>
  barbers.find((barber) => barber.id === id) ?? null;

export function getSelectedServices(services: Service[], serviceIds: string[]): Service[] {
  return services.filter((service) => serviceIds.includes(service.id));
}

export function getTotals(services: Service[], serviceIds: string[]) {
  const selected = getSelectedServices(services, serviceIds);
  return {
    durationMin: selected.reduce((sum, service) => sum + service.durationMin, 0),
    price: selected.reduce((sum, service) => sum + service.price, 0),
  };
}

export function getEndTime(time: string, durationMin: number): string {
  return fromMinutes(toMinutes(time) + durationMin);
}

export { formatPhone, isValidName, isValidPhone } from "@barbershop/shared/format";
