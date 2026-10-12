const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

/** Deep link b_<token>: бот привяжет запись к Telegram и будет присылать подтверждения и напоминания. */
export function TelegramNotifyLink({ token, className = "" }: { token: string; className?: string }) {
  if (!BOT_USERNAME) return null;

  return (
    <a
      href={`https://t.me/${BOT_USERNAME}?start=b_${token}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center justify-between gap-4 border border-bone/15 px-5 py-4 transition-colors duration-300 hover:border-tungsten ${className}`}
    >
      <span>
        <span className="block text-sm text-bone">Напоминания в Telegram</span>
        <span className="mt-1 block text-xs text-ash">Подтверждение, напоминание накануне и за 30 минут</span>
      </span>
      <span aria-hidden="true" className="text-ash transition-colors group-hover:text-tungsten">
        →
      </span>
    </a>
  );
}
