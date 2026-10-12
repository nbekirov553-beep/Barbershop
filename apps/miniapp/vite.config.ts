import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const envDir = "../..";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const apiTarget = env.API_URL || "http://localhost:4100";

  return {
    envDir,
    publicDir: "../web/public",
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: true,
      // Для проверки внутри Telegram Mini App открывается через HTTPS-туннель на этот порт.
      allowedHosts: true,
      proxy: { "/api": apiTarget },
    },
    preview: { port: 4173, proxy: { "/api": apiTarget } },
  };
});
