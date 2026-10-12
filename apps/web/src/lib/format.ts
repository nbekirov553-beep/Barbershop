import { pluralize } from "@barbershop/shared/format";

export { formatDuration, formatPrice, pluralize } from "@barbershop/shared/format";

export function formatYears(years: number): string {
  return pluralize(years, ["год", "года", "лет"]);
}

export function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Tashkent",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}
