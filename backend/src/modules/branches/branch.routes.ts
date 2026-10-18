import { Router, type Request, type Response } from "express";
import { idParam, ok, requireUser, requireVendorId } from "../../lib/http.js";
import { adminOnly, optionalAuth, vendorOnly } from "../../middleware/auth.js";
import { requestPoint } from "../geo/geo.js";
import { branchInputSchema, branchUpdateSchema, nearbyQuery, setOnlineSchema } from "./branch.schema.js";
import * as service from "./branch.service.js";
import { tradingForWrites } from "../vendors/vendor-guard.js";

const actorOf = (req: Request) => {
  const auth = requireUser(req);
  return { id: auth.userId, role: auth.role, vendorId: auth.vendorId };
};

/** Public: /branches/nearby (send X-Location) */
export const branchesRouter = Router();
branchesRouter.get("/nearby", optionalAuth, async (req: Request, res: Response) => {
  const { limit } = nearbyQuery.parse(req.query);
  res.json(ok(await service.nearbyShops(requestPoint(req), limit)));
});

/** Vendor portal: /vendor/branches */
export const vendorBranchesRouter = Router();
vendorBranchesRouter.use(vendorOnly);
vendorBranchesRouter.use(tradingForWrites);

vendorBranchesRouter.get("/", async (req: Request, res: Response) => {
  res.json(ok(await service.listVendorBranches(requireVendorId(req))));
});

vendorBranchesRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createVendorBranch(requireVendorId(req), branchInputSchema.parse(req.body), actorOf(req))));
});

vendorBranchesRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateVendorBranch(requireVendorId(req), id, branchUpdateSchema.parse(req.body), actorOf(req))));
});

vendorBranchesRouter.patch("/:id/online", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.setBranchOnline(requireVendorId(req), id, setOnlineSchema.parse(req.body), actorOf(req))));
});

/** Admin: /admin/branches (read-only; shops are run by their vendors) */
export const adminBranchesRouter = Router();
adminBranchesRouter.use(adminOnly);
adminBranchesRouter.get("/", async (_req: Request, res: Response) => {
  res.json(ok(await service.listAllBranches()));
});
