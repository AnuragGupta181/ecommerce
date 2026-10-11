import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { Role } from "../generated/prisma/enums.js";
import { AppError } from "./errors.js";

export type AccessPayload = { sub: string; role: Role };

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      throw AppError.unauthorized("Invalid token");
    }
    return { sub: decoded.sub, role: decoded.role as Role };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("UNAUTHORIZED", "Access token expired", { reason: "TOKEN_EXPIRED" });
    }
    throw AppError.unauthorized("Invalid token");
  }
}
