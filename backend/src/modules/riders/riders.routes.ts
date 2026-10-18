import { Router, type Request, type Response } from "express";
import { idParam, ok, requireVendorId } from "../../lib/http.js";
import { adminOnly, vendorOnly } from "../../middleware/auth.js";
import { riderInputSchema, riderListQuery, riderUpdateSchema } from "./riders.schema.js";
import * as service from "./riders.service.js";
import { tradingForWrites } from "../vendors/vendor-guard.js";

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

adminRidersRouter.post("/:id/link", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.rotateRiderLink(id)));
});

/** Vendor portal: /vendor/riders — the shop's own delivery partners. */
export const vendorRidersRouter = Router();
vendorRidersRouter.use(vendorOnly);
vendorRidersRouter.use(tradingForWrites);

const scope = (req: Request) => ({ vendorId: requireVendorId(req) });

vendorRidersRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listRiders(riderListQuery.parse(req.query), scope(req));
  res.json(ok(items, meta));
});

vendorRidersRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getRider(id, scope(req))));
});

vendorRidersRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createRider(riderInputSchema.parse(req.body), scope(req))));
});

vendorRidersRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateRider(id, riderUpdateSchema.parse(req.body), scope(req))));
});

vendorRidersRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.deleteRider(id, scope(req))));
});

vendorRidersRouter.post("/:id/link", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.rotateRiderLink(id, scope(req))));
});
