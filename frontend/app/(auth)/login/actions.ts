"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL, REFRESH_COOKIE, clearSession, revokeRefreshToken, writeSession } from "@/lib/auth/session-cookies";
import type { Session } from "@/lib/types";

export type LoginState = { error?: string; identifier?: string };

/** Only same-origin paths, so `next` cannot redirect to another site. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: "Enter your email and password", identifier };

  let session: Session;
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { error: json?.error?.message ?? "Could not sign in", identifier };
    session = json.data;
  } catch {
    return { error: "The store server is not reachable. Try again in a moment.", identifier };
  }

  if (session.user.role !== "ADMIN") {
    await revokeRefreshToken(session.refreshToken);
    return { error: "This account does not have admin access", identifier };
  }

  writeSession(await cookies(), session);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  clearSession(store);
  redirect("/login");
}
