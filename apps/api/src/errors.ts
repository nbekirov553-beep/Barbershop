import type { ApiError } from "@barbershop/shared";
import type { FastifyError, FastifyInstance } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (code: string, message: string) => new AppError(404, code, message);

export function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler<FastifyError | Error>((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ code: error.code, message: error.message } satisfies ApiError);
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Некорректные данные",
        details: error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
      } satisfies ApiError);
    }

    const statusCode = "statusCode" in error ? (error.statusCode ?? 500) : 500;
    if (statusCode < 500) {
      return reply
        .status(statusCode)
        .send({ code: "BAD_REQUEST", message: error.message } satisfies ApiError);
    }

    request.log.error(error);
    return reply
      .status(500)
      .send({ code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" } satisfies ApiError);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      code: "NOT_FOUND",
      message: `Маршрут ${request.method} ${request.url} не найден`,
    } satisfies ApiError);
  });
}
