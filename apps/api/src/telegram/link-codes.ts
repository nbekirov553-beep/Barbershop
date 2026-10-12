import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@barbershop/db";

export const BARBER_LINK_PREFIX = "barber_";
const LINK_TTL_MS = 24 * 60 * 60_000;

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

export async function createBarberLinkCode(prisma: PrismaClient, barberId: string) {
  const code = randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);
  await prisma.barberLinkCode.create({ data: { barberId, codeHash: hashCode(code), expiresAt } });
  return { code, expiresAt };
}

export type ConsumeResult = { ok: true; barberName: string } | { ok: false };

/** Код срабатывает один раз: used_at выставляется условным update, параллельный повтор получит count = 0. */
export async function consumeBarberLinkCode(
  prisma: PrismaClient,
  code: string,
  chatId: number,
): Promise<ConsumeResult> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const link = await tx.barberLinkCode.findUnique({ where: { codeHash: hashCode(code) } });
    if (!link) return { ok: false };

    const { count } = await tx.barberLinkCode.updateMany({
      where: { id: link.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (count === 0) return { ok: false };

    const barber = await tx.barber.update({
      where: { id: link.barberId },
      data: { telegramChatId: BigInt(chatId) },
      select: { name: true },
    });
    return { ok: true, barberName: barber.name };
  });
}
