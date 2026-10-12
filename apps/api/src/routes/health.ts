import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "ok", time: new Date().toISOString() };
    } catch (error) {
      request.log.error(error, "Health check: база недоступна");
      return reply.status(503).send({ status: "degraded", db: "unavailable" });
    }
  });
}
