import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE = "usto_admin";
const LOGIN_PATH = "/admin/login";

/** Быстрый редирект без cookie; саму сессию проверяет API (/api/v1/admin/me). */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === LOGIN_PATH || request.cookies.has(ADMIN_COOKIE)) return NextResponse.next();

  const url = new URL(LOGIN_PATH, request.url);
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
