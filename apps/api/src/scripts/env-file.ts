import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const ENV_PATH = fileURLToPath(new URL("../../../../.env", import.meta.url));

/** Добавляет или заменяет KEY="value" в корневом .env, не трогая остальные строки. */
export async function upsertEnv(values: Record<string, string>) {
  let content = await readFile(ENV_PATH, "utf8");
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}="${value}"`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
  }
  await writeFile(ENV_PATH, content);
}

/** <ref> из https://<ref>.supabase.co. */
export function supabaseProjectRef(supabaseUrl: string | undefined): string {
  const ref = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
  if (!ref) {
    console.error("SUPABASE_URL не задан в .env");
    process.exit(1);
  }
  return ref;
}
