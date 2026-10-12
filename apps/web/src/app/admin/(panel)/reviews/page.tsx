"use client";

import { useState } from "react";
import type { AdminReview } from "@barbershop/shared";
import { formatDateLong, pluralize } from "@barbershop/shared/format";
import { localDate } from "@/components/admin/booking-dialogs";
import { Empty, LoadState, Notice, PageHeader } from "@/components/admin/ui";
import { adminApi, errorMessage } from "@/lib/admin-api";
import { useRemote } from "@/lib/use-remote";

type Filter = "all" | "public" | "hidden";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "public", label: "На сайте" },
  { value: "hidden", label: "Скрытые" },
];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm tracking-[0.15em]" aria-label={`Оценка ${rating} из 5`}>
      <span className="text-bone">{"★".repeat(rating)}</span>
      <span className="text-bone/20">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function AdminReviewsPage() {
  const reviews = useRemote("reviews", adminApi.reviews);
  const [filter, setFilter] = useState<Filter>("all");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const withOverrides = (reviews.data ?? []).map((review) =>
    review.id in overrides ? { ...review, isPublic: overrides[review.id] } : review,
  );
  const visible = withOverrides.filter((review) =>
    filter === "all" ? true : filter === "public" ? review.isPublic : !review.isPublic,
  );
  const average = withOverrides.length ? withOverrides.reduce((sum, review) => sum + review.rating, 0) / withOverrides.length : 0;

  const toggle = async (review: AdminReview) => {
    setError(null);
    const next = !review.isPublic;
    setOverrides((current) => ({ ...current, [review.id]: next }));
    try {
      await adminApi.updateReview(review.id, next);
    } catch (failure) {
      setOverrides((current) => ({ ...current, [review.id]: review.isPublic }));
      setError(errorMessage(failure));
    }
  };

  return (
    <>
      <PageHeader
        title="Отзывы"
        description={
          withOverrides.length
            ? `${pluralize(withOverrides.length, ["отзыв", "отзыва", "отзывов"])}, средняя оценка ${average.toFixed(1).replace(".", ",")}`
            : "Бот просит оценить визит после стрижки. Здесь решаете, что показать на сайте."
        }
      />

      <div className="mb-6 flex gap-1" role="radiogroup" aria-label="Фильтр">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={`h-9 border px-4 text-sm transition-colors ${
              filter === item.value ? "border-bone bg-bone text-graphite" : "border-bone/15 text-ash hover:text-bone"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="mb-6">
          <Notice>{error}</Notice>
        </div>
      )}

      {reviews.status !== "ready" ? (
        <LoadState status={reviews.status === "error" ? "error" : "loading"} onRetry={reviews.reload} />
      ) : visible.length === 0 ? (
        <Empty>Отзывов нет.</Empty>
      ) : (
        <ul className="divide-y divide-bone/10 border-y border-bone/10">
          {visible.map((review) => (
            <li key={review.id} className="grid gap-4 px-2 py-5 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Stars rating={review.rating} />
                  <p className="text-sm font-medium">{review.clientName}</p>
                  <p className="text-xs text-ash">
                    мастер {review.barberName}, визит {formatDateLong(localDate(review.visitAt))}
                  </p>
                </div>
                <p className={`mt-2 max-w-2xl text-sm ${review.comment ? "" : "text-ash"}`}>
                  {review.comment ?? "Без комментария"}
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-ash">
                <span>На сайте</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={review.isPublic}
                  aria-label={`Показывать отзыв ${review.clientName} на сайте`}
                  onClick={() => toggle(review)}
                  className={`relative h-6 w-11 border transition-colors ${review.isPublic ? "border-bone bg-bone" : "border-bone/25"}`}
                >
                  <span
                    className={`absolute top-0.5 size-4 transition-all ${review.isPublic ? "left-[1.375rem] bg-graphite" : "left-0.5 bg-ash"}`}
                  />
                </button>
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
