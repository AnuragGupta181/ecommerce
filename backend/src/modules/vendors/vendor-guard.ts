import type { NextFunction, Request, Response } from "express";
import { requireVendorId } from "../../lib/http.js";
import { assertVendorCanTrade } from "./vendors.service.js";

/** For vendor actions that change orders, stock or plans: suspended and rejected shops are read-only. */
export async function requireTradingVendor(req: Request, _res: Response, next: NextFunction) {
  await assertVendorCanTrade(requireVendorId(req));
  next();
}

/** Router-level: reads stay open, writes need a shop in good standing. */
export function tradingForWrites(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET") return next();
  return requireTradingVendor(req, res, next);
}
