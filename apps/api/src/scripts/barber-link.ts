/**
 * Одноразовая ссылка для привязки Telegram-чата барбера.
 * npm run barber:link -- "Тимур"   (часть имени или id)
 * npm run barber:link              (список барберов и статус привязки)
 */
import { createPrismaClient } from "@barbershop/db";
import { env } from "../env";
import { BARBER_LINK_PREFIX, createBarberLinkCode } from "../telegram/link-codes";

const prisma = createPrismaClient(env.DATABASE_URL);
const query = process.argv.slice(2).join(" ").trim();

try {
  const barbers = await prisma.barber.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, telegramChatId: true },
  });

  if (!query) {
    for (const barber of barbers) {
      console.log(`${barber.telegramChatId ? "[привязан]" : "[нет]     "} ${barber.name}  ${barber.id}`);
    }
    console.log('\nСсылка: npm run barber:link -- "Имя"');
  } else {
    const matches = barbers.filter(
      (barber) => barber.id === query || barber.name.toLowerCase().includes(query.toLowerCase()),
    );
    if (matches.length !== 1) {
      console.error(matches.length === 0 ? "Барбер не найден" : `Уточните имя: ${matches.map((b) => b.name).join(", ")}`);
      process.exitCode = 1;
    } else if (!env.TELEGRAM_BOT_USERNAME) {
      console.error("Задайте TELEGRAM_BOT_USERNAME в .env");
      process.exitCode = 1;
    } else {
      const [barber] = matches;
      const { code, expiresAt } = await createBarberLinkCode(prisma, barber.id);
      console.log(`${barber.name}: https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${BARBER_LINK_PREFIX}${code}`);
      console.log(`Действует до ${expiresAt.toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })}, сработает один раз.`);
    }
  }
} finally {
  await prisma.$disconnect();
}
