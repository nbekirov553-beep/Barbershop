import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

loadEnvConfig(path.resolve(process.cwd(), "../.."));

const apiUrl = (process.env.API_URL ?? "http://localhost:4100").replace(/\/$/, "");
const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@barbershop/shared"],
  images: {
    // Фото мастеров и портфолио, загруженные из админки в Supabase Storage.
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async rewrites() {
    // Админка ходит в API через свой домен: session cookie остаётся first-party и SameSite=Strict.
    return [{ source: "/api/v1/admin/:path*", destination: `${apiUrl}/api/v1/admin/:path*` }];
  },
};

export default nextConfig;
