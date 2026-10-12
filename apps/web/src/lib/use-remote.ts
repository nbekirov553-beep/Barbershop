import { useCallback, useEffect, useRef, useState } from "react";

export type RemoteState<T> =
  | { status: "idle" | "loading"; data: undefined; error: undefined }
  | { status: "ready"; data: T; error: undefined }
  | { status: "error"; data: undefined; error: unknown };

type Settled<T> = { key: string; data?: T; error?: unknown; failed: boolean };

/**
 * Загружает данные по ключу. Пока результат не совпадает с текущим ключом — статус loading,
 * поэтому синхронный setState в эффекте не нужен. key = null — ничего не загружать.
 * reload() перезапрашивает, не сбрасывая показанные данные (stale-while-revalidate).
 */
export function useRemote<T>(key: string | null, load: () => Promise<T>) {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  const fullKey = key === null ? null : `${key}#${attempt}`;

  useEffect(() => {
    if (fullKey === null) return;
    let isActive = true;
    loadRef.current().then(
      (data) => isActive && setSettled({ key: fullKey, data, failed: false }),
      (error: unknown) => isActive && setSettled({ key: fullKey, error, failed: true }),
    );
    return () => {
      isActive = false;
    };
  }, [fullKey]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const baseKey = (value: string) => value.slice(0, value.lastIndexOf("#"));
  const isStale = settled !== null && fullKey !== null && settled.key !== fullKey && baseKey(settled.key) === key;

  let state: RemoteState<T>;
  if (fullKey === null) state = { status: "idle", data: undefined, error: undefined };
  else if (settled?.key === fullKey || (isStale && !settled.failed)) {
    state = settled!.failed
      ? { status: "error", data: undefined, error: settled!.error }
      : { status: "ready", data: settled!.data as T, error: undefined };
  } else state = { status: "loading", data: undefined, error: undefined };

  return { ...state, reload, isRefreshing: isStale };
}
