import { Router, type Request, type Response } from "express";
import { idParam, ok } from "../../lib/http.js";
import { adminOnly } from "../../middleware/auth.js";
import { riderInputSchema, riderListQuery, riderUpdateSchema } from "./riders.schema.js";
import * as service from "./riders.service.js";

export const adminRidersRouter = Router();
adminRidersRouter.use(adminOnly);

adminRidersRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listRiders(riderListQuery.parse(req.query));
  res.json(ok(items, meta));
});

adminRidersRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getRider(id)));
});

adminRidersRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createRider(riderInputSchema.parse(req.body))));
});

adminRidersRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateRider(id, riderUpdateSchema.parse(req.body))));
});

adminRidersRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.deleteRider(id)));
});
