import { randomDigits } from "./crypto.js";
import { slugify } from "./slug.js";

/**
 * Builds a slug from `source` and appends a short numeric suffix until `isTaken` reports it free.
 * `isTaken` should ignore the record being updated.
 */
export async function uniqueSlug(source: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(source) || "item";
  if (!(await isTaken(base))) return base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${randomDigits(4)}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
