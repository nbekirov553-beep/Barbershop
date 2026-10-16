import { adminLoginSchema, type AdminMe } from "@barbershop/shared";
import type { FastifyInstance } from "fastify";
import {
  ADMIN_COOKIE,
  createSession,
  deleteSession,
  requireAdmin,
  sessionCookieOptions,
  verifyCredentials,
} from "../../admin/auth.js";
import { AppError } from "../../errors.js";

const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW = "15 minutes";

export async function adminAuthRoutes(app: FastifyInstance, options: { secureCookies: boolean }) {
  app.post(
    "/api/v1/admin/login",
    {
      config: {
        rateLimit: {
          max: LOGIN_ATTEMPTS,
          timeWindow: LOGIN_WINDOW,
          // preHandler: тело уже разобрано — лимит считается на логин, а не на IP прокси сайта.
          hook: "preHandler",
          keyGenerator: (request) => {
            const parsed = adminLoginSchema.safeParse(request.body);
            return `admin-login:${parsed.success ? parsed.data.login : request.ip}`;
          },
          errorResponseBuilder: (_request, context) =>
            new AppError(429, "TOO_MANY_ATTEMPTS", `Слишком много попыток входа. Попробуйте через ${context.after}.`),
        },
      },
    },
    async (request, reply): Promise<AdminMe> => {
      const { login, password } = adminLoginSchema.parse(request.body);
      const admin = await verifyCredentials(app.prisma, login, password);
      if (!admin) throw new AppError(401, "INVALID_CREDENTIALS", "Неверный логин или пароль");

      const session = await createSession(app.prisma, admin.id);
      reply.setCookie(ADMIN_COOKIE, session.token, sessionCookieOptions(options.secureCookies, session.expiresAt));
      return { login: admin.login };
    },
  );

  app.post("/api/v1/admin/logout", async (request, reply) => {
    const token = request.cookies[ADMIN_COOKIE];
    if (token) await deleteSession(app.prisma, token);
    reply.clearCookie(ADMIN_COOKIE, sessionCookieOptions(options.secureCookies));
    return reply.status(204).send();
  });

  app.get("/api/v1/admin/me", async (request): Promise<AdminMe> => {
    const admin = await requireAdmin(request);
    return { login: admin.login };
  });
}
