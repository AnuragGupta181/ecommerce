import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, clearSession, revokeRefreshToken } from "@/lib/auth/session-cookies";

/** The backend rejected the session: clearing cookies here prevents a login/dashboard redirect loop. */
export async function GET(request: NextRequest) {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  clearSession(store);
  return NextResponse.redirect(new URL("/login?expired=1", request.url));
}
