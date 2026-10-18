import type { Session, SessionUser } from "@/lib/types";

/** Display-only copy of the signed-in user. Authorization always comes from the token, never from this. */
export type PortalProfile = Pick<SessionUser, "name" | "email"> & {
  role: PortalRole;
  vendorRole: "OWNER" | "STAFF" | null;
  isSuperAdmin: boolean;
};

/**
 * Cookie contract shared by proxy.ts, Server Actions and Route Handlers.
 * Tokens live only in httpOnly cookies, so client JS never sees them.
 */
export const ACCESS_COOKIE = "haat_at";
export const REFRESH_COOKIE = "haat_rt";
export const ADMIN_COOKIE = "haat_admin";

const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;
/** Refresh slightly early so a token never expires mid-request. */
const EXPIRY_SKEW_SECONDS = 30;

export const API_URL = process.env.API_URL ?? "http://localhost:4000/api/v1";

type CookieOptions = { httpOnly: boolean; secure: boolean; sameSite: "lax"; path: string; maxAge: number };
type CookieWriter = {
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
};

export type TokenPayload = { sub: string; role: string; exp: number; vid?: string; sa?: boolean };

/** Who may use the portal: admins get `/`, shop owners and staff get `/vendor`. */
export type PortalRole = "ADMIN" | "VENDOR";

export function homeFor(role: PortalRole): string {
  return role === "VENDOR" ? "/vendor" : "/";
}

/** Paths a role may open; everything else redirects to its home. */
export function pathAllowed(role: PortalRole, pathname: string): boolean {
  const vendorArea = pathname === "/vendor" || pathname.startsWith("/vendor/");
  return role === "VENDOR" ? vendorArea : !vendorArea;
}

/** Reads the JWT payload without verifying it: the backend verifies every call, this only routes. */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload.sub === "string" && typeof payload.exp === "number" ? payload : null;
  } catch {
    return null;
  }
}

function isFresh(payload: TokenPayload): boolean {
  return payload.exp - EXPIRY_SKEW_SECONDS > Date.now() / 1000;
}

export function isPortalRole(role: string): role is PortalRole {
  return role === "ADMIN" || role === "VENDOR";
}

/** The portal role of a usable (unexpired) token, or null. */
export function portalRoleOf(token: string | undefined): PortalRole | null {
  const payload = token ? decodeToken(token) : null;
  return payload && isFresh(payload) && isPortalRole(payload.role) ? payload.role : null;
}

export function isUsableAdminToken(token: string | undefined): token is string {
  return portalRoleOf(token) === "ADMIN";
}

export function isUsableVendorToken(token: string | undefined): token is string {
  const payload = token ? decodeToken(token) : null;
  return portalRoleOf(token) === "VENDOR" && !!payload?.vid;
}

function cookieOptions(maxAge: number): CookieOptions {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge };
}

export function writeSession(store: CookieWriter, session: Session) {
  const exp = decodeToken(session.accessToken)?.exp ?? 0;
  store.set(ACCESS_COOKIE, session.accessToken, cookieOptions(Math.max(60, exp - Math.floor(Date.now() / 1000))));
  store.set(REFRESH_COOKIE, session.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  const profile: PortalProfile = {
    name: session.user.name,
    email: session.user.email,
    role: session.user.role === "VENDOR" ? "VENDOR" : "ADMIN",
    vendorRole: session.user.vendorRole ?? null,
    isSuperAdmin: session.user.isSuperAdmin ?? false,
  };
  store.set(ADMIN_COOKIE, JSON.stringify(profile), cookieOptions(REFRESH_MAX_AGE));
}

export function clearSession(store: CookieWriter) {
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  store.delete(ADMIN_COOKIE);
}

export type RefreshOutcome = { kind: "ok"; session: Session } | { kind: "invalid" } | { kind: "unavailable" };

async function callRefresh(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { kind: "invalid" };
    if (!res.ok) return { kind: "unavailable" };
    const { data } = (await res.json()) as { data: Session };
    return { kind: "ok", session: data };
  } catch {
    return { kind: "unavailable" };
  }
}

const recentRefreshes = new Map<string, { outcome: Promise<RefreshOutcome>; until: number }>();

/**
 * Prefetches fire in parallel with the same refresh token. Sharing one rotation per token
 * stops them racing; the backend also tolerates a brief race for multi-instance hosting.
 */
export function refreshSession(refreshToken: string): Promise<RefreshOutcome> {
  const now = Date.now();
  for (const [token, entry] of recentRefreshes) if (entry.until < now) recentRefreshes.delete(token);
  const cached = recentRefreshes.get(refreshToken);
  if (cached) return cached.outcome;
  const outcome = callRefresh(refreshToken);
  recentRefreshes.set(refreshToken, { outcome, until: now + 15_000 });
  return outcome;
}

export async function revokeRefreshToken(refreshToken: string) {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  }).catch(() => undefined);
}
