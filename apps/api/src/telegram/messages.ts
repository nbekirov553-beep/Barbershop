import { escapeHtml, formatSlot, ratingStars, shopAddress } from "@barbershop/notifications";
import { formatPhone, formatPrice } from "@barbershop/shared/format";
import { shop } from "@barbershop/shared/shop";

export { escapeHtml, formatSlot };

export type BookingMessageData = {
  startsAt: Date;
  endsAt: Date;
  totalPrice: number;
  barber: { name: string };
  client: { name: string; phone: string };
  services: { name: string }[];
};

function details(booking: BookingMessageData, timezone: string): string {
  return [
    `<b>${formatSlot(booking.startsAt, booking.endsAt, timezone)}</b>`,
    `Мастер: ${escapeHtml(booking.barber.name)}`,
    `Услуги: ${escapeHtml(booking.services.map((service) => service.name).join(", "))}`,
    `Итого: ${formatPrice(booking.totalPrice)}`,
  ].join("\n");
}

export const clientMessages = {
  created: (booking: BookingMessageData, timezone: string) =>
    [`<b>Запись подтверждена</b>`, "", details(booking, timezone), "", shopAddress].join("\n"),

  linked: (booking: BookingMessageData, timezone: string, isActive: boolean) =>
    [
      isActive ? "<b>Ваша запись</b>" : "<b>Запись</b>",
      "",
      details(booking, timezone),
      "",
      isActive ? "Пришлём напоминание накануне и за 30 минут до визита." : "Запись уже неактивна.",
    ].join("\n"),

  cancelled: (booking: BookingMessageData, timezone: string) =>
    [
      "<b>Запись отменена</b>",
      "",
      `${formatSlot(booking.startsAt, booking.endsAt, timezone)}, ${escapeHtml(booking.barber.name)}`,
      "",
      "Будем рады видеть вас в другой раз.",
    ].join("\n"),

  rated: (barberName: string, rating: number) =>
    [`<b>Спасибо за оценку!</b>`, "", `${ratingStars(rating)} — мастер ${escapeHtml(barberName)}.`].join("\n"),

  rescheduled: (booking: BookingMessageData, previous: { startsAt: Date; endsAt: Date }, timezone: string) =>
    [
      "<b>Запись перенесена</b>",
      "",
      `Было: <s>${formatSlot(previous.startsAt, previous.endsAt, timezone)}</s>`,
      "",
      details(booking, timezone),
    ].join("\n"),
};

const clientLine = (booking: BookingMessageData) =>
  `Клиент: ${escapeHtml(booking.client.name)}, ${formatPhone(booking.client.phone)}`;

export const barberMessages = {
  created: (booking: BookingMessageData, timezone: string) =>
    [
      "<b>Новая запись</b>",
      "",
      `<b>${formatSlot(booking.startsAt, booking.endsAt, timezone)}</b>`,
      clientLine(booking),
      `Услуги: ${escapeHtml(booking.services.map((service) => service.name).join(", "))}`,
      `Итого: ${formatPrice(booking.totalPrice)}`,
    ].join("\n"),

  cancelled: (booking: BookingMessageData, timezone: string) =>
    ["<b>Отмена записи</b>", "", formatSlot(booking.startsAt, booking.endsAt, timezone), clientLine(booking)].join(
      "\n",
    ),

  rescheduled: (booking: BookingMessageData, previous: { startsAt: Date; endsAt: Date }, timezone: string) =>
    [
      "<b>Перенос записи</b>",
      "",
      `Было: <s>${formatSlot(previous.startsAt, previous.endsAt, timezone)}</s>`,
      `Стало: <b>${formatSlot(booking.startsAt, booking.endsAt, timezone)}</b>`,
      clientLine(booking),
    ].join("\n"),

  linked: (name: string) =>
    `Готово, ${escapeHtml(name)}. Сюда будут приходить новые записи, отмены и переносы.`,
};

export const startText = (firstName: string) =>
  [
    `Салам, ${escapeHtml(firstName)}!`,
    "",
    "Это бот парикмахерской Usto. Здесь можно записаться, посмотреть свои записи и получать напоминания о визитах.",
  ].join("\n");

export const contactsText = () =>
  [
    `<b>${shop.name}</b>, ${shop.tagline.toLowerCase()}`,
    shopAddress,
    `Телефон: ${shop.phone}`,
    "",
    ...shop.hours.map((item) => `${item.days}: ${item.time}`),
  ].join("\n");
