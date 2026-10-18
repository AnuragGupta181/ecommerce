import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSession,
  homeFor,
  isPortalRole,
  pathAllowed,
  portalRoleOf,
  refreshSession,
  writeSession,
  type PortalRole,
} from "@/lib/auth/session-cookies";

/** Pages anyone can open: shop signup and the rider's private schedule (the token in the URL is the key). */
function isPublic(pathname: string): boolean {
  return pathname === "/vendor/signup" || pathname.startsWith("/r/");
}

/**
 * Guards every page and keeps the access token fresh before rendering starts.
 * Admins live under `/`, vendors under `/vendor`; each is sent home if it wanders into the other area.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const isLogin = pathname === "/login";
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  const role = portalRoleOf(accessToken);
  if (role) return isLogin ? redirectHome(request, role) : guardArea(request, role) ?? NextResponse.next();
  if (!refreshToken) return isLogin ? NextResponse.next() : toLogin(request);

  const outcome = await refreshSession(refreshToken);
  // Backend unreachable: let the page render its error state instead of logging the user out.
  if (outcome.kind === "unavailable") return NextResponse.next();
  if (outcome.kind === "invalid" || !isPortalRole(outcome.session.user.role)) {
    const response = isLogin ? NextResponse.next() : toLogin(request);
    clearSession(response.cookies);
    return response;
  }

  const freshRole = outcome.session.user.role;
  const redirect = isLogin ? redirectHome(request, freshRole) : guardArea(request, freshRole);
  if (redirect) {
    writeSession(redirect.cookies, outcome.session);
    return redirect;
  }
  // Forward the new tokens to this render as well as to the browser.
  request.cookies.set(ACCESS_COOKIE, outcome.session.accessToken);
  request.cookies.set(REFRESH_COOKIE, outcome.session.refreshToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  writeSession(response.cookies, outcome.session);
  return response;
}

function redirectHome(request: NextRequest, role: PortalRole) {
  return NextResponse.redirect(new URL(homeFor(role), request.url));
}

function guardArea(request: NextRequest, role: PortalRole): NextResponse | null {
  return pathAllowed(role, request.nextUrl.pathname) ? null : redirectHome(request, role);
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
