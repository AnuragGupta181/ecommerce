import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ok } from "../../lib/http.js";
import { adminOnly } from "../../middleware/auth.js";
import { getDashboard } from "./dashboard.service.js";

export const adminDashboardRouter = Router();
adminDashboardRouter.use(adminOnly);

adminDashboardRouter.get("/", async (req: Request, res: Response) => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).parse(req.query);
  res.json(ok(await getDashboard(days)));
});
