import type { Review } from "@barbershop/shared";
import { formatReviewDate } from "@/lib/format";

const layout = [
  "lg:col-span-8 text-[clamp(1.6rem,3.2vw,3rem)]",
  "lg:col-span-6 lg:col-start-7 text-[clamp(1.25rem,2.2vw,2rem)]",
  "lg:col-span-5 lg:col-start-2 text-[clamp(1.25rem,2.2vw,2rem)]",
];

export function Voices({ reviews }: { reviews: Review[] }) {
  const featured = reviews
    .filter((review) => review.comment)
    .toSorted((a, b) => (b.comment?.length ?? 0) - (a.comment?.length ?? 0))
    .slice(0, layout.length);

  if (featured.length === 0) return null;

  return (
    <section aria-labelledby="voices-title" className="border-t border-bone/10">
      <div className="container-page py-28 lg:py-40">
        <h2 id="voices-title" className="text-sm text-ash">
          Гости о мастерах
        </h2>

        <div className="mt-14 grid gap-20 lg:grid-cols-12 lg:gap-y-28">
          {featured.map((review, index) => (
            <figure key={review.id} className={layout[index]}>
              <blockquote className="font-display leading-[1.2] font-light tracking-[-0.03em]">
                <p>«{review.comment}»</p>
              </blockquote>
              <figcaption className="mt-6 flex flex-wrap gap-x-6 gap-y-1 font-sans text-sm text-ash">
                <span className="text-bone">{review.author}</span>
                <span>Мастер: {review.barberName}</span>
                <span>{formatReviewDate(review.date)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
