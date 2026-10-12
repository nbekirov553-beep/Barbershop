import { reviewSchema, type Review } from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function reviewsRoutes(app: FastifyInstance) {
  app.get("/api/v1/reviews", async (): Promise<Review[]> => {
    const reviews = await app.prisma.review.findMany({
      where: { isPublic: true, barber: { isActive: true } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        barberId: true,
        barber: { select: { name: true } },
        client: { select: { name: true } },
      },
    });

    return z.array(reviewSchema).parse(
      reviews.map((review) => ({
        id: review.id,
        author: review.client.name,
        barberId: review.barberId,
        barberName: review.barber.name,
        rating: review.rating,
        comment: review.comment,
        date: review.createdAt.toISOString(),
      })),
    );
  });
}
