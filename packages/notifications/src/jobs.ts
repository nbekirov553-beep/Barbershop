import postgres, { type Fragment, type Sql, type TransactionSql } from "postgres";
import {
  ratingKeyboard,
  reminderKeyboard,
  reminderMessages,
  type InlineKeyboardMarkup,
  type ReminderBooking,
} from "./messages.ts";
import type { SendMessage } from "./telegram.ts";

export type { Sql };

export type NotificationSettings = {
  timezone: string;
  reminderDayMin: number;
  reminderShortMin: number;
  reviewDelayMin: number;
};

export const notificationDefaults: NotificationSettings = {
  timezone: "Asia/Tashkent",
  reminderDayMin: 1440,
  reminderShortMin: 30,
  reviewDelayMin: 60,
};

/** Старые визиты (например, после простоя cron) отзыв уже не запрашивают. */
const REVIEW_MAX_AGE_MIN = 2 * 24 * 60;
const BATCH_SIZE = 50;

export type Outcome = { sent: number; failed: number; retry: number };

export type NotificationsReport = {
  day: Outcome;
  short: Outcome;
  autoCompleted: number;
  review: Outcome;
};

export type RunOptions = {
  sql: Sql;
  send: SendMessage;
  /** Публичный адрес сайта для кнопки «Перенести»; не-HTTPS адреса Telegram не принимает. */
  appUrl: string;
  now?: Date;
  log?: (message: string, data: Record<string, unknown>) => void;
};

/** pgbouncer=true — параметр Prisma; Postgres его не знает. prepare: false нужен для transaction pooler. */
export function createSql(databaseUrl: string): Sql {
  const url = new URL(databaseUrl);
  url.searchParams.delete("pgbouncer");
  return postgres(url.toString(), { prepare: false, max: 1, onnotice: () => {} });
}

/**
 * Напоминание считается отправленным, если запись создана или перенесена уже внутри его окна:
 * клиент только что получил подтверждение, повторять его незачем.
 */
export function reminderMarks(startsAt: Date, now: Date, settings: Pick<NotificationSettings, "reminderDayMin" | "reminderShortMin">) {
  const lead = startsAt.getTime() - now.getTime();
  return {
    reminderDaySentAt: lead <= settings.reminderDayMin * 60_000 ? now : null,
    reminder30mSentAt: lead <= settings.reminderShortMin * 60_000 ? now : null,
  };
}

const toPositive = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export async function loadNotificationSettings(sql: Sql): Promise<NotificationSettings> {
  const rows = await sql<{ key: string; value: string }[]>`select key, value from settings`;
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    timezone: map.get("timezone") || notificationDefaults.timezone,
    reminderDayMin: toPositive(map.get("reminder_day_minutes"), notificationDefaults.reminderDayMin),
    reminderShortMin: toPositive(map.get("reminder_short_minutes"), notificationDefaults.reminderShortMin),
    reviewDelayMin: toPositive(map.get("review_delay_min"), notificationDefaults.reviewDelayMin),
  };
}

type Row = ReminderBooking & { id: string; chatId: string };

type Job = {
  name: "day" | "short" | "review";
  column: "reminder_day_sent_at" | "reminder_30m_sent_at" | "review_requested_at";
  where: (tx: TransactionSql) => Fragment;
  message: (row: Row) => { text: string; keyboard?: InlineKeyboardMarkup };
};

/**
 * Идемпотентность: строки блокируются FOR UPDATE SKIP LOCKED, отметка ставится в той же транзакции.
 * Параллельный запуск пропускает заблокированные записи, повторный — уже отмеченные.
 */
async function deliver(options: RunOptions, job: Job, now: Date): Promise<Outcome> {
  const { sql, send, log } = options;
  return sql.begin(async (tx) => {
    const rows = await tx<Row[]>`
      select
        b.id,
        b.manage_token as "manageToken",
        b.starts_at as "startsAt",
        b.ends_at as "endsAt",
        ba.name as "barberName",
        coalesce((select string_agg(s.name, ', ' order by s.name) from booking_services s where s.booking_id = b.id), '') as services,
        coalesce(c.telegram_chat_id, c.telegram_id)::text as "chatId"
      from bookings b
      join clients c on c.id = b.client_id
      join barbers ba on ba.id = b.barber_id
      where coalesce(c.telegram_chat_id, c.telegram_id) is not null and ${job.where(tx)}
      order by b.starts_at
      limit ${BATCH_SIZE}
      for update of b skip locked
    `;

    const outcome: Outcome = { sent: 0, failed: 0, retry: 0 };
    for (const row of rows) {
      const { text, keyboard } = job.message(row);
      const result = await send(row.chatId, text, keyboard);
      if (!result.ok && !result.permanent) {
        outcome.retry += 1;
        log?.("notifications: повторим позже", { job: job.name, bookingId: row.id, error: result.description });
        continue;
      }
      if (result.ok) outcome.sent += 1;
      else {
        outcome.failed += 1;
        log?.("notifications: доставка невозможна", { job: job.name, bookingId: row.id, error: result.description });
      }
      await tx`update bookings set ${tx(job.column)} = ${now} where id = ${row.id}`;
    }
    return outcome;
  });
}

export async function runNotifications(options: RunOptions): Promise<NotificationsReport> {
  const now = options.now ?? new Date();
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
  const settings = await loadNotificationSettings(options.sql);
  const tz = settings.timezone;

  const day = await deliver(
    options,
    {
      name: "day",
      column: "reminder_day_sent_at",
      where: (tx) => tx`
        b.status = 'confirmed' and b.reminder_day_sent_at is null
        and b.starts_at > ${at(settings.reminderShortMin)} and b.starts_at <= ${at(settings.reminderDayMin)}
      `,
      message: (row) => ({
        text: reminderMessages.day(row, tz),
        keyboard: reminderKeyboard(row.manageToken, options.appUrl),
      }),
    },
    now,
  );

  const short = await deliver(
    options,
    {
      name: "short",
      column: "reminder_30m_sent_at",
      where: (tx) => tx`
        b.status = 'confirmed' and b.reminder_30m_sent_at is null
        and b.starts_at > ${now} and b.starts_at <= ${at(settings.reminderShortMin)}
      `,
      message: (row) => ({ text: reminderMessages.short(row, tz) }),
    },
    now,
  );

  const completed = await options.sql`
    update bookings set status = 'completed', auto_completed_at = ${now}
    where status = 'confirmed' and ends_at <= ${now}
    returning id
  `;

  const review = await deliver(
    options,
    {
      name: "review",
      column: "review_requested_at",
      where: (tx) => tx`
        b.status = 'completed' and b.review_requested_at is null
        and b.ends_at <= ${at(-settings.reviewDelayMin)} and b.ends_at > ${at(-REVIEW_MAX_AGE_MIN)}
        and not exists (select 1 from reviews r where r.booking_id = b.id)
      `,
      message: (row) => ({ text: reminderMessages.review(row, tz), keyboard: ratingKeyboard(row.manageToken) }),
    },
    now,
  );

  return { day, short, autoCompleted: completed.count, review };
}
