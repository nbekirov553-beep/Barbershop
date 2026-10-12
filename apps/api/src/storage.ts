import { randomUUID } from "node:crypto";
import { AppError } from "./errors";

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
/** Лимит тела запроса serverless-функции Vercel — 4,5 МБ. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type MediaStorage = {
  /** Загружает файл в публичный bucket и возвращает его постоянный URL. */
  upload: (file: Buffer, contentType: string, folder: string) => Promise<string>;
};

/** Supabase Storage через REST и service role key; ключ остаётся на сервере. */
export function createSupabaseStorage(options: { url: string; serviceRoleKey: string; bucket?: string }): MediaStorage {
  const base = options.url.replace(/\/$/, "");
  const bucket = options.bucket ?? "media";
  const headers = { Authorization: `Bearer ${options.serviceRoleKey}`, apikey: options.serviceRoleKey };
  let ready: Promise<void> | undefined;

  const ensureBucket = async () => {
    const existing = await fetch(`${base}/storage/v1/bucket/${bucket}`, { headers });
    if (existing.ok) return;
    const created = await fetch(`${base}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: true,
        file_size_limit: MAX_IMAGE_BYTES,
        allowed_mime_types: Object.keys(IMAGE_TYPES),
      }),
    });
    if (!created.ok) throw new Error(`Storage: не удалось создать bucket ${bucket}: ${await created.text()}`);
  };

  return {
    async upload(file, contentType, folder) {
      ready ??= ensureBucket().catch((error: unknown) => {
        ready = undefined;
        throw error;
      });
      await ready;

      const path = `${folder}/${randomUUID()}.${IMAGE_TYPES[contentType]}`;
      const response = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": contentType, "cache-control": "31536000" },
        body: new Uint8Array(file),
      });
      if (!response.ok) throw new Error(`Storage: загрузка не удалась: ${await response.text()}`);
      return `${base}/storage/v1/object/public/${bucket}/${path}`;
    },
  };
}

export const unavailableStorage: MediaStorage = {
  upload: async () => {
    throw new AppError(503, "STORAGE_UNAVAILABLE", "Хранилище фото не настроено (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  },
};
