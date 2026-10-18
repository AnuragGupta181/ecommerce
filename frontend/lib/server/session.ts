import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  ADMIN_COOKIE,
  decodeToken,
  isUsableAdminToken,
  isUsableVendorToken,
  type PortalProfile,
} from "@/lib/auth/session-cookies";

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

/** Server Actions call one of these first: they authorise themselves rather than trusting the page that rendered them. */
export async function requireAdmin(): Promise<string> {
  const token = await getAccessToken();
  if (!isUsableAdminToken(token)) redirect("/session-expired");
  return token;
}

export async function requireSuperAdmin(): Promise<string> {
  const token = await requireAdmin();
  if (!decodeToken(token)?.sa) redirect("/");
  return token;
}

export async function requireVendor(): Promise<string> {
  const token = await getAccessToken();
  if (!isUsableVendorToken(token)) redirect("/session-expired");
  return token;
}

/** For pages that only some admins may see; the backend enforces it again on every call. */
export async function isSuperAdmin(): Promise<boolean> {
  const token = await getAccessToken();
  return !!(token && decodeToken(token)?.sa);
}

const FALLBACK: PortalProfile = { name: "Admin", email: "", role: "ADMIN", vendorRole: null, isSuperAdmin: false };

export async function getPortalProfile(): Promise<PortalProfile> {
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && "name" in parsed && typeof parsed.name === "string") {
      const read = <K extends keyof PortalProfile>(key: K): unknown => (key in parsed ? (parsed as Record<string, unknown>)[key] : undefined);
      const vendorRole = read("vendorRole");
      return {
        name: parsed.name,
        email: typeof read("email") === "string" ? (read("email") as string) : "",
        role: read("role") === "VENDOR" ? "VENDOR" : "ADMIN",
        vendorRole: vendorRole === "OWNER" || vendorRole === "STAFF" ? vendorRole : null,
        isSuperAdmin: read("isSuperAdmin") === true,
      };
    }
  } catch {
    // A malformed cookie only affects what the menu shows.
  }
  return FALLBACK;
}
