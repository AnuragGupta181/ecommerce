import { useAuthStore } from "./auth-store";
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

async function send<T>(path: string, options: Options, retry: boolean): Promise<Envelope<T>> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return { data: undefined as T };

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const error = json?.error;
    if (res.status === 401 && retry && error?.details?.reason === "TOKEN_EXPIRED" && (await refreshOnce())) {
      return send<T>(path, options, false);
    }
    throw new ApiError(res.status, error?.code ?? "NETWORK_ERROR", error?.message ?? "Something went wrong", error?.details);
  }
  return json as Envelope<T>;
}

export const api = {
  get: async <T>(path: string, query?: Query) => (await send<T>(path, { query }, true)).data,
  page: <T>(path: string, query?: Query) => send<T[]>(path, { query }, true),
  post: async <T>(path: string, body?: unknown) => (await send<T>(path, { method: "POST", body }, true)).data,
  patch: async <T>(path: string, body?: unknown) => (await send<T>(path, { method: "PATCH", body }, true)).data,
  put: async <T>(path: string, body?: unknown) => (await send<T>(path, { method: "PUT", body }, true)).data,
  delete: async <T>(path: string) => (await send<T>(path, { method: "DELETE" }, true)).data,
};
