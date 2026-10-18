import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "./errors.js";

export const idParam = z.object({ id: z.string().min(1) });

/** Returns the authenticated principal or throws 401. */
export function requireUser(req: Request) {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth;
}

/** The vendor id of a VENDOR principal (vendor routes are guarded by `vendorOnly`). */
export function requireVendorId(req: Request): string {
  const vendorId = req.auth?.vendorId;
  if (!vendorId) throw AppError.forbidden("This login is not linked to a shop");
  return vendorId;
}

/**
 * For responses identical for every visitor (no auth, no location): browsers keep them a minute,
 * the CDN five, and serve stale while refreshing so nobody waits on the origin.
 */
export function publicCache(res: Response, cdnSeconds = 300) {
  res.set("Cache-Control", `public, max-age=60, s-maxage=${cdnSeconds}, stale-while-revalidate=${cdnSeconds * 2}`);
}

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return meta ? { data, meta } : { data };
}
