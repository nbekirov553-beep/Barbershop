import { argon2, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PrismaClient } from "@barbershop/db";
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyRequest } from "fastify";
import { AppError } from "../errors";

export const ADMIN_COOKIE = "usto_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

export type AdminIdentity = { id: string; login: string };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Argon2id из node:crypto без нативных зависимостей (важно для serverless).
 * Параметры и формат PHC те же, что у @node-rs/argon2: старые хеши продолжают проверяться.
 */
const ARGON2 = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 };
const argon2Async = promisify(argon2);
const toB64 = (value: Buffer) => value.toString("base64").replace(/=+$/, "");
const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

async function hash(password: string) {
  const nonce = randomBytes(16);
  const tag = await argon2Async("argon2id", { message: password, nonce, ...ARGON2 });
  return `$argon2id$v=19$m=${ARGON2.memory},t=${ARGON2.passes},p=${ARGON2.parallelism}$${toB64(nonce)}$${toB64(tag)}`;
}

async function verify(encoded: string, password: string) {
  const match = PHC.exec(encoded);
  if (!match) return false;
  const [, memory, passes, parallelism, salt, expected] = match;
  const expectedTag = Buffer.from(expected, "base64");
  const tag = await argon2Async("argon2id", {
    message: password,
    nonce: Buffer.from(salt, "base64"),
    memory: Number(memory),
    passes: Number(passes),
    parallelism: Number(parallelism),
    tagLength: expectedTag.length,
  });
  return timingSafeEqual(tag, expectedTag);
}

export const hashPassword = (password: string) => hash(password);

let dummyHash: Promise<string> | undefined;

/** Для несуществующего логина тоже считаем Argon2: время ответа не выдаёт, есть ли такой админ. */
export async function verifyCredentials(
  prisma: PrismaClient,
  login: string,
  password: string,
): Promise<AdminIdentity | null> {
  const admin = await prisma.adminUser.findUnique({ where: { login } });
  dummyHash ??= hash(randomBytes(16).toString("hex"));
  const passwordHash = admin?.passwordHash ?? (await dummyHash);
  const isValid = await verify(passwordHash, password).catch(() => false);
  return admin && isValid ? { id: admin.id, login: admin.login } : null;
}

export async function createSession(prisma: PrismaClient, adminId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.$transaction([
    prisma.adminSession.deleteMany({ where: { adminId, expiresAt: { lt: new Date() } } }),
    prisma.adminSession.create({ data: { adminId, tokenHash: sha256(token), expiresAt } }),
  ]);
  return { token, expiresAt };
}

export async function findSessionAdmin(prisma: PrismaClient, token: string): Promise<AdminIdentity | null> {
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    select: { expiresAt: true, admin: { select: { id: true, login: true } } },
  });
  return session && session.expiresAt > new Date() ? session.admin : null;
}

export const deleteSession = (prisma: PrismaClient, token: string) =>
  prisma.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });

/** SameSite=Strict: cookie не уходит с чужих сайтов — это и защита от CSRF. */
export const sessionCookieOptions = (secure: boolean, expires?: Date): CookieSerializeOptions => ({
  httpOnly: true,
  sameSite: "strict",
  secure,
  path: "/",
  ...(expires ? { expires } : {}),
});

export async function requireAdmin(request: FastifyRequest): Promise<AdminIdentity> {
  const token = request.cookies[ADMIN_COOKIE];
  const admin = token ? await findSessionAdmin(request.server.prisma, token) : null;
  if (!admin) throw new AppError(401, "ADMIN_UNAUTHORIZED", "Нужно войти в админку");
  request.admin = admin;
  return admin;
}
