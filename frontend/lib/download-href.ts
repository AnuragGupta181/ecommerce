/** The link a page puts on a download button; the matching route handler streams the file from the backend. */
export function downloadHref(base: "/download" | "/vendor/download", path: string, query: Record<string, string | undefined> = {}): string {
  const search = new URLSearchParams({ path });
  for (const [key, value] of Object.entries(query)) if (value) search.set(key, value);
  return `${base}?${search.toString()}`;
}
