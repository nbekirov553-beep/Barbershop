import {
  adminReviewPatchSchema,
  adminSettingsInputSchema,
  type AdminReview,
  type AdminSettings,
} from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadSettings, settingKeys } from "../../domain/settings";
import { notFound } from "../../errors";

const idParams = z.object({ id: z.uuid({ error: "Некорректный id отзыва" }) });
const REVIEWS_LIMIT = 200;

export async function adminReviewsSettingsRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/reviews", async (): Promise<AdminReview[]> => {
    const reviews = await app.prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: REVIEWS_LIMIT,
      include: {
        barber: { select: { name: true } },
        client: { select: { name: true } },
        booking: { select: { startsAt: true } },
      },
    });
    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isPublic: review.isPublic,
      createdAt: review.createdAt.toISOString(),
      visitAt: review.booking.startsAt.toISOString(),
      barberName: review.barber.name,
      clientName: review.client.name,
    }));
  });

  app.patch("/api/v1/admin/reviews/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const { isPublic } = adminReviewPatchSchema.parse(request.body);
    const { count } = await app.prisma.review.updateMany({ where: { id }, data: { isPublic } });
    if (count === 0) throw notFound("REVIEW_NOT_FOUND", "Отзыв не найден");
    return { id, isPublic };
  });

  app.get("/api/v1/admin/settings", async (): Promise<AdminSettings> => {
    const { slotStepMin, ...settings } = await loadSettings(app.prisma);
    return { ...settings, slotStepMin: slotStepMin as AdminSettings["slotStepMin"] };
  });

  app.put("/api/v1/admin/settings", async (request): Promise<AdminSettings> => {
    const body = adminSettingsInputSchema.parse(request.body);
    await app.prisma.$transaction(
      Object.entries(settingKeys).map(([field, key]) => {
        const value = String(body[field as keyof typeof settingKeys]);
        return app.prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
      }),
    );
    const { slotStepMin, ...settings } = await loadSettings(app.prisma);
    return { ...settings, slotStepMin: slotStepMin as AdminSettings["slotStepMin"] };
  });
}
