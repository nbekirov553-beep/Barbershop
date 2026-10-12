import type { Metadata, Viewport } from "next";
import "@fontsource-variable/onest";
import "@fontsource-variable/unbounded";
import "./globals.css";

export const metadata: Metadata = {
  title: "Usto | Мужская парикмахерская в Ташкенте",
  description:
    "Стрижки, борода и королевское бритьё у метро «Космонавтлар». Онлайн-запись к мастеру без очереди.",
};

export const viewport: Viewport = {
  themeColor: "#0c0d0e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
