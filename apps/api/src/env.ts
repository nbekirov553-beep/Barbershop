import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { parseEnv } from "./config.js";

/** Для CLI-скриптов: читает корневой .env и завершает процесс при ошибке. HTTP-сервер использует parseEnv напрямую. */
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const parsed = parseEnv(process.env);

if (!parsed.ok) {
  console.error("Некорректные переменные окружения:", parsed.errors);
  process.exit(1);
}

export const env = parsed.env;
