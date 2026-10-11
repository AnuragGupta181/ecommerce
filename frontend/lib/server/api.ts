import "server-only";
import { redirect } from "next/navigation";
import { API_URL } from "@/lib/auth/session-cookies";
import type { PageMeta, Paginated } from "@/lib/types";
import { getAccessToken } from "./session";

/** The only module that talks to the backend. Tokens are attached here and never leave the server. */

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

export type Query = Record<string, string | number | boolean | null | undefined>;

type RequestOptions = { query?: Query; body?: unknown; form?: FormData };
type Envelope<T> = { data: T; meta?: PageMeta };

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  const token = await getAccessToken();
  if (!token) redirect("/session-expired");

  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { method, headers, body, cache: "no-store" });
  if (res.status === 204) return { data: undefined as T };

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) redirect("/session-expired");
    const error = json?.error;
    throw new ApiError(
      res.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "The server could not complete the request",
      error?.details,
    );
  }
  return json as Envelope<T>;
}

export const api = {
  get: async <T>(path: string, query?: Query) => (await request<T>("GET", path, { query })).data,
  list: async <T>(path: string, query?: Query): Promise<Paginated<T>> => {
    const { data, meta } = await request<T[]>("GET", path, { query });
    return { items: data, meta: meta ?? { page: 1, limit: data.length, total: data.length, totalPages: 1 } };
  },
  post: async <T>(path: string, body?: unknown) => (await request<T>("POST", path, { body })).data,
  patch: async <T>(path: string, body?: unknown) => (await request<T>("PATCH", path, { body })).data,
  put: async <T>(path: string, body?: unknown) => (await request<T>("PUT", path, { body })).data,
  delete: async <T>(path: string) => (await request<T>("DELETE", path)).data,
  upload: async <T>(path: string, form: FormData) => (await request<T>("POST", path, { form })).data,
};
