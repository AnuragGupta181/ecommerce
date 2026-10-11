import { Router, type Request, type Response } from "express";
import { ok, requireUser } from "../../lib/http.js";
import { paginationQuery } from "../../lib/pagination.js";
import { authenticate } from "../../middleware/auth.js";
import * as service from "./coins.service.js";

export const coinsRouter = Router();
coinsRouter.use(authenticate);

coinsRouter.get("/", async (req: Request, res: Response) => {
  const { meta, ...summary } = await service.getCoinSummary(requireUser(req).userId, paginationQuery.parse(req.query));
  res.json(ok(summary, meta));
});
