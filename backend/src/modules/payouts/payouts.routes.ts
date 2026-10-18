import { Router, type Request, type Response } from "express";
import { idParam, ok, requireUser, requireVendorId } from "../../lib/http.js";
import { adminOnly, vendorOnly } from "../../middleware/auth.js";
import * as service from "./payouts.service.js";

const actorOf = (req: Request) => {
  const auth = requireUser(req);
  return { id: auth.userId, role: auth.role, vendorId: auth.vendorId };
};

/** Admin: /admin/payouts */
export const adminPayoutsRouter = Router();
adminPayoutsRouter.use(adminOnly);

adminPayoutsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listPayouts({}, service.payoutListQuery.parse(req.query));
  res.json(ok(items, meta));
});

adminPayoutsRouter.get("/preview/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.previewSettlement(id, service.periodSchema.parse(req.query))));
});

adminPayoutsRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createPayout(service.createPayoutSchema.parse(req.body), actorOf(req))));
});

adminPayoutsRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getPayout({}, id)));
});

adminPayoutsRouter.post("/:id/paid", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.markPayoutPaid(id, service.markPaidSchema.parse(req.body), actorOf(req))));
});

/** Vendor portal: /vendor/payouts (read-only statements) */
export const vendorPayoutsRouter = Router();
vendorPayoutsRouter.use(vendorOnly);

vendorPayoutsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listPayouts({ vendorId: requireVendorId(req) }, service.payoutListQuery.parse(req.query));
  res.json(ok(items, meta));
});

vendorPayoutsRouter.get("/upcoming", async (req: Request, res: Response) => {
  res.json(ok(await service.previewSettlement(requireVendorId(req), service.periodSchema.parse(req.query))));
});

vendorPayoutsRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getPayout({ vendorId: requireVendorId(req) }, id)));
});
