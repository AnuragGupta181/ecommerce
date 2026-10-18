import type { NextFunction, Request, Response } from "express";
import type { Role } from "../generated/prisma/enums.js";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken, type AccessPayload } from "../lib/jwt.js";

function toAuth(payload: AccessPayload): NonNullable<Request["auth"]> {
  return { userId: payload.sub, role: payload.role, vendorId: payload.vid, isSuperAdmin: payload.sa };
}

function readBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim() || undefined;
}

/** Requires a valid access token. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) throw AppError.unauthorized();
  req.auth = toAuth(verifyAccessToken(token));
  next();
}

/** Attaches the user when a valid token is present; guests pass through. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (token) {
    try {
      req.auth = toAuth(verifyAccessToken(token));
    } catch {
      // An expired token on a public endpoint just means "browse as guest".
    }
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw AppError.unauthorized();
    if (!roles.includes(req.auth.role)) throw AppError.forbidden();
    next();
  };
}

export const adminOnly = [authenticate, requireRole("ADMIN")];

function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.isSuperAdmin) throw AppError.forbidden("Only the super admin can do this");
  next();
}

export const superAdminOnly = [authenticate, requireRole("ADMIN"), requireSuperAdmin];

function requireVendorAccount(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.vendorId) throw AppError.forbidden("This login is not linked to a shop");
  next();
}

/** Vendor portal routes. Approval is checked per action (a pending vendor can still set up its shop). */
export const vendorOnly = [authenticate, requireRole("VENDOR"), requireVendorAccount];
