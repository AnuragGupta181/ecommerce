import { Router, type Request, type Response } from "express";
import { idParam, ok, requireUser } from "../../lib/http.js";
import { paginationQuery } from "../../lib/pagination.js";
import { adminOnly } from "../../middleware/auth.js";
import { adjustStockSchema, inventoryListQuery, thresholdSchema } from "./inventory.schema.js";
import * as service from "./inventory.service.js";

export const adminInventoryRouter = Router();
adminInventoryRouter.use(adminOnly);

adminInventoryRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listInventory(inventoryListQuery.parse(req.query));
  res.json(ok(items, meta));
});

adminInventoryRouter.get("/summary", async (_req: Request, res: Response) => {
  res.json(ok(await service.inventorySummary()));
});

adminInventoryRouter.post("/variants/:id/adjust", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const input = adjustStockSchema.parse(req.body);
  res.json(ok(await service.adjustStock(id, input, requireUser(req).userId)));
});

adminInventoryRouter.patch("/variants/:id/threshold", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { lowStockThreshold } = thresholdSchema.parse(req.body);
  res.json(ok(await service.updateThreshold(id, lowStockThreshold)));
});

adminInventoryRouter.get("/variants/:id/movements", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { items, meta } = await service.listMovements(id, paginationQuery.parse(req.query));
  res.json(ok(items, meta));
});
