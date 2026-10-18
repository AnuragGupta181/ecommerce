import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { runDaily } from "./daily.service.js";

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; nothing else may trigger jobs. */
function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  const expected = env.CRON_SECRET;
  if (!expected) throw AppError.serviceUnavailable("CRON_SECRET is not configured");
  const given = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw AppError.unauthorized("Invalid cron secret");
  next();
}

export const cronRouter = Router();
cronRouter.use(requireCronSecret);

// Vercel Cron issues GET requests; POST is kept for manual runs.
cronRouter.get("/daily", async (_req: Request, res: Response) => {
  res.json(ok(await runDaily()));
});
cronRouter.post("/daily", async (_req: Request, res: Response) => {
  res.json(ok(await runDaily()));
});
