import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createPrismaClient, type ServiceCategory, type TimeOffType } from "../src/index";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const prisma = createPrismaClient(process.env.DIRECT_URL ?? process.env.DATABASE_URL);

const TZ_OFFSET = "+05:00";
const at = (date: string, time: string) => new Date(`${date}T${time}:00${TZ_OFFSET}`);
const clock = (time: string) => new Date(`1970-01-01T${time}:00Z`);
const token = () => randomBytes(24).toString("base64url");

const services: {
  key: string;
  name: string;
  description: string;
  category: ServiceCategory;
  durationMin: number;
  price: number;
}[] = [
  { key: "haircut", name: "Мужская стрижка", description: "Консультация, мытьё головы, стрижка и укладка", category: "hair", durationMin: 60, price: 150000 },
  { key: "clipper", name: "Стрижка машинкой", description: "Одна или две насадки, окантовка триммером", category: "hair", durationMin: 30, price: 90000 },
  { key: "combo", name: "Стрижка и борода", description: "Полный образ за один визит", category: "hair", durationMin: 90, price: 220000 },
  { key: "kids", name: "Детская стрижка", description: "Для мальчиков до 12 лет", category: "hair", durationMin: 40, price: 80000 },
  { key: "beard", name: "Моделирование бороды", description: "Форма, контур опасной бритвой, уход маслом", category: "beard", durationMin: 45, price: 100000 },
  { key: "shave", name: "Королевское бритьё", description: "Горячее полотенце, опасная бритва, лосьон после бритья", category: "beard", durationMin: 45, price: 120000 },
];

/** dayOff совпадает с моками сайта: 1 = понедельник. */
const barbers = [
  {
    key: "timur",
    name: "Тимур Рахимов",
    photoUrl: "/images/barber-timur.jpg",
    bio: "Классические мужские стрижки и аккуратные переходы. Расскажет, как укладывать волосы дома за пять минут.",
    experienceYears: 9,
    specialties: ["Классика", "Фейд"],
    dayOff: 1,
  },
  {
    key: "aziz",
    name: "Азиз Каримов",
    photoUrl: "/images/barber-aziz.jpg",
    bio: "Работает с бородой любой длины: от лёгкой щетины до объёмной формы. Мастер королевского бритья.",
    experienceYears: 6,
    specialties: ["Борода", "Бритьё"],
    dayOff: 2,
  },
  {
    key: "rustam",
    name: "Рустам Юсупов",
    photoUrl: "/images/barber-rustam.jpg",
    bio: "Современные текстурные стрижки и кроп. Любит сложные запросы и фото-референсы.",
    experienceYears: 4,
    specialties: ["Текстура", "Кроп"],
    dayOff: 3,
  },
  {
    key: "denis",
    name: "Денис Ли",
    photoUrl: "/images/barber-denis.jpg",
    bio: "Спокойный мастер, к которому приводят детей. Быстрые стрижки машинкой без потери качества.",
    experienceYears: 5,
    specialties: ["Машинка", "Детские"],
    dayOff: 4,
  },
];

const pastVisits = [
  { client: "Шерзод", phone: "+998901110001", barber: "timur", service: "haircut", date: "2026-09-14", time: "12:00", rating: 5, comment: "Хожу к Тимуру уже год. Ни разу не ждал дольше пары минут, стрижка держит форму до следующего визита." },
  { client: "Алексей", phone: "+998901110002", barber: "aziz", service: "shave", date: "2026-09-02", time: "15:00", rating: 5, comment: "Азиз впервые сделал бороде нормальную форму. Королевское бритьё стоит попробовать отдельно." },
  { client: "Бехзод", phone: "+998901110003", barber: "rustam", service: "haircut", date: "2026-08-27", time: "11:00", rating: 5, comment: "Принёс фото, объяснил, что хочу. Рустам предложил вариант под мой тип волос, и это лучше, чем на фото." },
  { client: "Марина", phone: "+998901110004", barber: "denis", service: "kids", date: "2026-08-19", time: "10:00", rating: 4, comment: "Водим сына к Денису. Ребёнок сидит спокойно, а это для нас главное. Удобно, что рядом метро." },
];

const settings: Record<string, string> = {
  cancel_cutoff_min: "30",
  slot_step_min: "15",
  booking_horizon_days: "30",
  min_notice_min: "30",
  reminder_day_minutes: "1440",
  reminder_short_minutes: "30",
  review_delay_min: "60",
  timezone: "Asia/Tashkent",
  review_public_min_rating: "4",
};

const timeOff: { barber: string | null; startsAt: Date; endsAt: Date; type: TimeOffType; note: string }[] = [
  { barber: null, startsAt: at("2026-12-31", "18:00"), endsAt: at("2027-01-02", "00:00"), type: "holiday", note: "Новый год" },
  { barber: "aziz", startsAt: at("2026-10-19", "00:00"), endsAt: at("2026-10-23", "00:00"), type: "vacation", note: "Отпуск" },
];

async function main() {
  await prisma.$transaction([
    prisma.review.deleteMany(),
    prisma.bookingService.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.client.deleteMany(),
    prisma.timeOff.deleteMany(),
    prisma.break.deleteMany(),
    prisma.workingHours.deleteMany(),
    prisma.barberService.deleteMany(),
    prisma.portfolioItem.deleteMany(),
    prisma.service.deleteMany(),
    prisma.barber.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  const serviceIds = new Map<string, string>();
  for (const [index, { key, ...data }] of services.entries()) {
    const service = await prisma.service.create({ data: { ...data, sortOrder: index } });
    serviceIds.set(key, service.id);
  }

  const barberIds = new Map<string, string>();
  for (const [index, { key, dayOff, ...data }] of barbers.entries()) {
    const workdays = [0, 1, 2, 3, 4, 5, 6].filter((weekday) => weekday !== dayOff);
    const barber = await prisma.barber.create({
      data: {
        ...data,
        sortOrder: index,
        services: {
          create: [...serviceIds.values()].map((serviceId) => ({ serviceId })),
        },
        workingHours: {
          create: workdays.map((weekday) => ({
            weekday,
            startTime: clock("10:00"),
            endTime: clock(weekday === 0 || weekday === 6 ? "20:00" : "21:00"),
          })),
        },
        breaks: {
          create: workdays.map((weekday) => ({
            weekday,
            startTime: clock("13:00"),
            endTime: clock("14:00"),
          })),
        },
      },
    });
    barberIds.set(key, barber.id);
  }

  await prisma.timeOff.createMany({
    data: timeOff.map(({ barber, ...item }) => ({
      ...item,
      barberId: barber ? barberIds.get(barber) : null,
    })),
  });

  for (const visit of pastVisits) {
    const service = services.find((item) => item.key === visit.service)!;
    const startsAt = at(visit.date, visit.time);
    const client = await prisma.client.create({ data: { name: visit.client, phone: visit.phone } });
    const barberId = barberIds.get(visit.barber)!;

    await prisma.booking.create({
      data: {
        clientId: client.id,
        barberId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + service.durationMin * 60_000),
        totalPrice: service.price,
        totalDurationMin: service.durationMin,
        status: "completed",
        source: "web",
        manageToken: token(),
        services: {
          create: {
            serviceId: serviceIds.get(service.key),
            name: service.name,
            durationMin: service.durationMin,
            price: service.price,
          },
        },
        review: {
          create: {
            barberId,
            clientId: client.id,
            rating: visit.rating,
            comment: visit.comment,
            isPublic: visit.rating >= Number(settings.review_public_min_rating),
            createdAt: new Date(startsAt.getTime() + 3 * 3_600_000),
          },
        },
      },
    });
  }

  await prisma.setting.createMany({
    data: Object.entries(settings).map(([key, value]) => ({ key, value })),
  });

  const counts = {
    services: await prisma.service.count(),
    barbers: await prisma.barber.count(),
    workingHours: await prisma.workingHours.count(),
    breaks: await prisma.break.count(),
    timeOff: await prisma.timeOff.count(),
    bookings: await prisma.booking.count(),
    reviews: await prisma.review.count(),
    settings: await prisma.setting.count(),
  };
  console.log("Seed готов:", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
