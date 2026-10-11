export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a query param, trimmed; empty strings count as absent. */
export function param(params: SearchParams, key: string): string | undefined {
  const raw = params[key];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value : undefined;
}

export function pageParam(params: SearchParams): number {
  const page = Number(param(params, "page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Builds a URL that keeps the current filters but overrides some of them. */
export function hrefWith(pathname: string, params: SearchParams, overrides: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") query.delete(key);
    else query.set(key, String(value));
  }
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}
