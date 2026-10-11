import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSession,
  isUsableAdminToken,
  refreshSession,
  writeSession,
} from "@/lib/auth/session-cookies";

/** Guards every page and keeps the access token fresh before rendering starts. */
export async function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/login";
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (isUsableAdminToken(accessToken)) {
    return isLogin ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!refreshToken) return isLogin ? NextResponse.next() : toLogin(request);

  const outcome = await refreshSession(refreshToken);
  // Backend unreachable: let the page render its error state instead of logging the admin out.
  if (outcome.kind === "unavailable") return NextResponse.next();
  if (outcome.kind === "invalid" || outcome.session.user.role !== "ADMIN") {
    const response = isLogin ? NextResponse.next() : toLogin(request);
    clearSession(response.cookies);
    return response;
  }

  if (isLogin) {
    const response = NextResponse.redirect(new URL("/", request.url));
    writeSession(response.cookies, outcome.session);
    return response;
  }
  // Forward the new tokens to this render as well as to the browser.
  request.cookies.set(ACCESS_COOKIE, outcome.session.accessToken);
  request.cookies.set(REFRESH_COOKIE, outcome.session.refreshToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  writeSession(response.cookies, outcome.session);
  return response;
}

function toLogin(request: NextRequest) {
  const url = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|session-expired|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
