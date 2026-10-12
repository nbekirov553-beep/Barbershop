import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Админка | Usto", template: "%s | Админка Usto" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
