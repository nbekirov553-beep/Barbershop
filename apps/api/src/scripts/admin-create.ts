import { randomBytes } from "node:crypto";
import { createPrismaClient } from "@barbershop/db";
import { adminLoginSchema } from "@barbershop/shared";
import { hashPassword } from "../admin/auth";
import { env } from "../env";

/**
 * Создаёт администратора или меняет пароль существующего; все его сессии сбрасываются.
 *   npm run admin:create -- owner              — пароль сгенерируется и выведется один раз
 *   npm run admin:create -- owner "свой-пароль" — минимум 10 символов
 */
const MIN_PASSWORD_LENGTH = 10;
const [rawLogin, rawPassword] = process.argv.slice(2);

const parsed = adminLoginSchema.shape.login.safeParse(rawLogin ?? "");
if (!parsed.success) {
  console.error('Укажите логин: npm run admin:create -- <логин> ["пароль"]');
  process.exit(1);
}
if (rawPassword !== undefined && rawPassword.length < MIN_PASSWORD_LENGTH) {
  console.error(`Пароль — минимум ${MIN_PASSWORD_LENGTH} символов`);
  process.exit(1);
}

const login = parsed.data;
const password = rawPassword ?? randomBytes(12).toString("base64url");
const prisma = createPrismaClient(env.DATABASE_URL);

try {
  const passwordHash = await hashPassword(password);
  const admin = await prisma.adminUser.upsert({
    where: { login },
    update: { passwordHash },
    create: { login, passwordHash },
  });
  await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });
  console.log(`Администратор «${login}» готов. Вход: /admin/login`);
  if (!rawPassword) console.log(`Пароль (сохраните, повторно не показывается): ${password}`);
} finally {
  await prisma.$disconnect();
}
