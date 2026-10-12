import type { ButtonHTMLAttributes, ReactNode } from "react";
import { needsInlineBack, useTelegramBackButton } from "../lib/telegram";

type ScreenProps = {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  footer?: ReactNode;
  children: ReactNode;
};

export function Screen({ title, subtitle, onBack, footer, children }: ScreenProps) {
  useTelegramBackButton(onBack ?? null);

  return (
    <div className="flex min-h-[var(--tg-viewport-stable-height,100svh)] flex-col">
      <header className="px-4 pt-5 pb-4">
        {onBack && needsInlineBack && (
          <button type="button" onClick={onBack} className="mb-4 -ml-1 flex h-9 items-center gap-1 px-1 text-sm text-link">
            <span aria-hidden="true">‹</span> Назад
          </button>
        )}
        <h1 className="font-display text-[1.65rem] leading-[1.1] font-light tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-hint">{subtitle}</p>}
      </header>
      <main key={title} className="flex-1 animate-enter px-4 pb-6">
        {children}
      </main>
      {footer && (
        <footer className="sticky bottom-0 z-10 border-t border-separator bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          {footer}
        </footer>
      )}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
  /** По ширине содержимого вместо всей строки. */
  fit?: boolean;
};

const tones = {
  primary: "bg-accent text-on-accent disabled:opacity-40",
  secondary: "bg-section text-text disabled:opacity-50",
  danger: "bg-section text-destructive disabled:opacity-50",
};

export function Button({ tone = "primary", fit = false, className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`flex h-12 ${fit ? "shrink-0" : "w-full"} items-center justify-center rounded-xl px-5 text-[15px] font-medium transition-[transform,opacity] duration-150 active:scale-[0.98] ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mb-4 rounded-xl px-4 py-3 text-sm ${
        tone === "error" ? "bg-destructive/10 text-text" : "bg-accent/12 text-text"
      }`}
    >
      {children}
    </p>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      {title && <h2 className="mb-2 px-1 text-xs tracking-wide text-hint uppercase">{title}</h2>}
      <div className="overflow-hidden rounded-2xl bg-section">{children}</div>
    </section>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-xl bg-section ${className}`} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-section p-5">
      <p className="font-medium">Не удалось загрузить</p>
      <p className="mt-1 text-sm text-hint">{message}</p>
      <Button tone="secondary" className="mt-4" onClick={onRetry}>
        Повторить
      </Button>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-separator px-4 py-3 text-[15px] last:border-b-0">
      <span className="text-hint">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface font-display text-sm text-hint"
      style={{ width: size, height: size }}
    >
      {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover grayscale" /> : initials}
    </span>
  );
}
