import { describe, expect, it } from "vitest";
import { barberMessages, clientMessages, escapeHtml, formatSlot, type BookingMessageData } from "./messages";

const TZ = "Asia/Tashkent";
const booking: BookingMessageData = {
  startsAt: new Date("2026-10-09T13:30:00Z"),
  endsAt: new Date("2026-10-09T14:30:00Z"),
  totalPrice: 150_000,
  barber: { name: "Тимур Рахимов" },
  client: { name: "<b>Хакер</b> & Co", phone: "+998901234567" },
  services: [{ name: "Мужская стрижка" }],
};

describe("telegram messages", () => {
  it("переводит время в часовой пояс салона", () => {
    expect(formatSlot(booking.startsAt, booking.endsAt, TZ)).toBe("пт, 9 октября, 18:30–19:30");
  });

  it("экранирует HTML в пользовательских данных", () => {
    expect(escapeHtml("<b>&</b>")).toBe("&lt;b&gt;&amp;&lt;/b&gt;");
    const text = barberMessages.created(booking, TZ);
    expect(text).toContain("&lt;b&gt;Хакер&lt;/b&gt; &amp; Co");
    expect(text).not.toContain("<b>Хакер");
  });

  it("сообщение мастеру содержит клиента и телефон", () => {
    const text = barberMessages.created(booking, TZ);
    expect(text).toContain("Новая запись");
    expect(text).toContain("+998 90 123-45-67");
    expect(text).toMatch(/150\s000 сум/);
  });

  it("перенос показывает старое и новое время", () => {
    const previous = { startsAt: new Date("2026-10-10T05:00:00Z"), endsAt: new Date("2026-10-10T06:00:00Z") };
    const text = clientMessages.rescheduled(booking, previous, TZ);
    expect(text).toContain("<s>сб, 10 октября, 10:00–11:00</s>");
    expect(text).toContain("пт, 9 октября, 18:30–19:30");
  });
});
