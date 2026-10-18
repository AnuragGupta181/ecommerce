import { useAuthStore } from "./auth-store";
import { locationHeader } from "./geo";
import { useLocationStore } from "./location-store";
import type { PageMeta, Session } from "./types";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;
type Options = { method?: string; query?: Query; body?: unknown };
type Envelope<T> = { data: T; meta?: PageMeta };

let refreshing: Promise<boolean> | null = null;

/** One rotation at a time: parallel queries share it instead of racing with the same refresh token. */
function refreshOnce(): Promise<boolean> {
  refreshing ??= (async () => {
    const { refreshToken, setSession, clear } = useAuthStore.getState();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) await clear();
        return false;
      }
      await setSession(((await res.json()) as Envelope<Session>).data);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function buildUrl(path: string, query?: Query): string {
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${API_URL}${path}${params.length ? `?${params.join("&")}` : ""}`;
}

async function send<T>(path: string, options: Options, retry = true): Promise<Envelope<T>> {
  const token = useAuthStore.getState().accessToken;
  // Prices, offers and fees depend on where the shopper is; the backend reads this on every route.
  const location = locationHeader(useLocationStore.getState().location);
  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(location ? { "X-Location": location } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the store. Check your connection.");
  }
  if (res.status === 204) return { data: undefined as T };

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = json?.error;
    if (res.status === 401 && retry && token && (await refreshOnce())) return send<T>(path, options, false);
    throw new ApiError(res.status, error?.code ?? "INTERNAL_ERROR", error?.message ?? "Something went wrong", error?.details);
  }
  return json as Envelope<T>;
}

export const api = {
  get: async <T>(path: string, query?: Query) => (await send<T>(path, { query })).data,
  page: <T>(path: string, query?: Query) => send<T[]>(path, { query }),
  post: async <T>(path: string, body?: unknown) => (await send<T>(path, { method: "POST", body })).data,
  patch: async <T>(path: string, body?: unknown) => (await send<T>(path, { method: "PATCH", body })).data,
  put: async <T>(path: string, body?: unknown) => (await send<T>(path, { method: "PUT", body })).data,
  delete: async <T>(path: string) => (await send<T>(path, { method: "DELETE" })).data,
};

/** First field error from a VALIDATION_ERROR response, keyed by path. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};
  const errors: Record<string, string> = {};
  for (const issue of error.details as { path?: string; message?: string }[]) {
    if (issue.path && issue.message) errors[issue.path] ??= issue.message;
  }
  return errors;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
