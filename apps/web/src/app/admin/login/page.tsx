"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Notice, inputClass } from "@/components/admin/ui";
import { adminApi, errorMessage } from "@/lib/admin-api";

/** Только внутренние пути админки: защита от открытого редиректа через ?next=. */
const safeNext = (value: string | null) => (value && value.startsWith("/admin") && !value.startsWith("//") ? value : "/admin");

export default function AdminLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      await adminApi.login(login, password);
      router.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
    } catch (failure) {
      setError(errorMessage(failure));
      setIsBusy(false);
    }
  };

  return (
    <main className="grid min-h-svh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm" noValidate>
        <p className="font-display text-base font-medium tracking-[0.2em]">USTO</p>
        <h1 className="mt-10 font-display text-2xl font-medium">Вход в админку</h1>
        <p className="mt-2 text-sm text-ash">Записи, мастера, график и настройки салона.</p>

        <div className="mt-8 space-y-5">
          <Field label="Логин">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                autoComplete="username"
                autoCapitalize="none"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                required
              />
            )}
          </Field>
          <Field label="Пароль">
            {(id) => (
              <input
                id={id}
                type="password"
                className={inputClass}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            )}
          </Field>
          {error && <Notice>{error}</Notice>}
          <Button type="submit" variant="primary" className="w-full" disabled={isBusy || !login || !password}>
            {isBusy ? "Входим…" : "Войти"}
          </Button>
        </div>
      </form>
    </main>
  );
}
