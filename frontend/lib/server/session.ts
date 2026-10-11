import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, ADMIN_COOKIE, isUsableAdminToken } from "@/lib/auth/session-cookies";

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

/** Server Actions call this first: they authorise themselves rather than trusting the page that rendered them. */
export async function requireAdmin(): Promise<string> {
  const token = await getAccessToken();
  if (!isUsableAdminToken(token)) redirect("/session-expired");
  return token;
}

export async function getAdminProfile(): Promise<{ name: string; email: string }> {
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && "name" in parsed && typeof parsed.name === "string") {
      const email = "email" in parsed && typeof parsed.email === "string" ? parsed.email : "";
      return { name: parsed.name, email };
    }
  } catch {
    // A malformed cookie only affects the display name.
  }
  return { name: "Admin", email: "" };
}
