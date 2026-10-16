import type { FastifyInstance } from "fastify";

/** Liveness: процесс жив и принимает запросы. Не трогает базу и Telegram, поэтому отвечает даже без env. */
export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true, status: "ok", time: new Date().toISOString() }));
}

/** Readiness базы: отдельный маршрут, чтобы сбой БД не делал «мёртвым» весь сервис. */
export async function dbHealthRoutes(app: FastifyInstance) {
  app.get("/health/db", async (request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "ok" };
    } catch (error) {
      request.log.error(error, "Health check: база недоступна");
      return reply.status(503).send({ status: "degraded", db: "unavailable" });
    }
  });
}
