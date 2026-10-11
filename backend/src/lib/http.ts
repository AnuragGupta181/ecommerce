import type { Request } from "express";
import { z } from "zod";
import { AppError } from "./errors.js";

export const idParam = z.object({ id: z.string().min(1) });

/** Returns the authenticated principal or throws 401. */
export function requireUser(req: Request) {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth;
}

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return meta ? { data, meta } : { data };
}
