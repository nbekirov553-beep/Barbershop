import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, type MediaStorage } from "../../storage";

const querySchema = z.object({ folder: z.enum(["barbers", "portfolio"]).default("barbers") });

export async function adminUploadsRoutes(app: FastifyInstance, options: { storage: MediaStorage }) {
  app.post("/api/v1/admin/uploads", async (request, reply) => {
    const { folder } = querySchema.parse(request.query);
    const file = await request.file({ limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });
    if (!file) throw new AppError(400, "FILE_REQUIRED", "Выберите файл");
    if (!IMAGE_TYPES[file.mimetype]) {
      throw new AppError(415, "UNSUPPORTED_IMAGE", "Поддерживаются JPG, PNG и WebP");
    }

    const buffer = await file.toBuffer();
    if (file.file.truncated) throw new AppError(413, "FILE_TOO_LARGE", "Файл больше 4 МБ");

    const url = await options.storage.upload(buffer, file.mimetype, folder);
    return reply.status(201).send({ url });
  });
}
