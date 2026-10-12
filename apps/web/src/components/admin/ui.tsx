"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import type { AdminBookingStatus } from "@barbershop/shared";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-bone text-graphite hover:bg-tungsten disabled:bg-bone/15 disabled:text-ash",
  secondary: "border border-bone/20 text-bone hover:border-bone/50 disabled:opacity-50",
  ghost: "text-ash hover:text-bone disabled:opacity-50",
  danger: "border border-red-400/40 text-red-300 hover:border-red-300 hover:bg-red-400/10 disabled:opacity-50",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex shrink-0 items-center justify-center gap-2 text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed ${
        size === "sm" ? "h-9 px-3" : "h-11 px-5"
      } ${buttonVariants[variant]} ${className}`}
    />
  );
}

export const inputClass =
  "h-11 w-full border border-bone/15 bg-graphite-2 px-3 text-sm text-bone outline-none transition-colors placeholder:text-ash/60 hover:border-bone/30 focus:border-tungsten disabled:opacity-60 aria-[invalid=true]:border-red-400/70";

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm text-ash">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1.5 text-sm text-red-300">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ash/80">{hint}</p>
      )}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-3 text-sm text-bone has-disabled:cursor-not-allowed has-disabled:opacity-60">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-tungsten"
      />
      {label}
    </label>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-bone/10 pb-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm text-ash">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Notice({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const tones = {
    error: "border-red-400/40 text-red-200",
    success: "border-tungsten/40 text-tungsten",
    info: "border-bone/15 text-ash",
  };
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`border-l-2 px-4 py-2 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}

export function LoadState({ status, onRetry }: { status: "loading" | "error" | "idle"; onRetry: () => void }) {
  if (status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-4 py-10">
        <p className="text-sm text-ash">Не получилось загрузить данные. Проверьте, что API запущен.</p>
        <Button size="sm" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3 py-4" aria-busy="true" aria-label="Загрузка">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-14 animate-pulse bg-graphite-2" />
      ))}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 border border-dashed border-bone/15 px-6 py-10">
      <p className="text-sm text-ash">{children}</p>
      {action}
    </div>
  );
}

/** Нативный <dialog>: фокус, Esc и затемнение фона браузер даёт сам. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto max-h-[92svh] w-[calc(100%-2rem)] overflow-y-auto border border-bone/15 bg-graphite p-0 text-bone backdrop:bg-black/70 ${
        wide ? "max-w-2xl" : "max-w-lg"
      }`}
    >
      {open && (
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h2 className="font-display text-lg font-medium">{title}</h2>
            <button type="button" onClick={onClose} className="text-sm text-ash hover:text-bone" aria-label="Закрыть">
              Закрыть
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export const statusLabels: Record<AdminBookingStatus, string> = {
  confirmed: "Ждём",
  completed: "Пришёл",
  cancelled: "Отменена",
  no_show: "Не пришёл",
};

const statusStyles: Record<AdminBookingStatus, string> = {
  confirmed: "border-bone/30 text-bone",
  completed: "border-transparent bg-bone/10 text-ash",
  cancelled: "border-transparent text-ash/70 line-through",
  no_show: "border-red-400/40 text-red-300",
};

export function StatusBadge({ status }: { status: AdminBookingStatus }) {
  return (
    <span className={`inline-flex h-6 items-center border px-2 text-xs whitespace-nowrap ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export const sourceLabels = { web: "Сайт", telegram: "Telegram", admin: "Админка" } as const;
