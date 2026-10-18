import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok, requireUser, requireVendorId } from "../../lib/http.js";
import { adminOnly, optionalAuth, vendorOnly } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rate-limit.js";
import { requestPoint } from "../geo/geo.js";
import {
  adminCreateVendorSchema,
  adminVendorUpdateSchema,
  staffInputSchema,
  vendorListQuery,
  vendorProfileUpdateSchema,
  vendorSignupSchema,
  vendorStatusActionSchema,
} from "./vendors.schema.js";
import * as service from "./vendors.service.js";
import { tradingForWrites } from "./vendor-guard.js";

const actorOf = (req: Request) => {
  const auth = requireUser(req);
  return { id: auth.userId, role: auth.role, vendorId: auth.vendorId };
};

/** Public: /vendors */
export const vendorsRouter = Router();

vendorsRouter.post("/signup", authLimiter, async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.signupVendor(vendorSignupSchema.parse(req.body))));
});

vendorsRouter.get("/:slug", optionalAuth, async (req: Request, res: Response) => {
  const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(req.params);
  res.json(ok(await service.getShop(slug, requestPoint(req))));
});

/** Vendor portal: /vendor/profile, /vendor/staff */
export const vendorProfileRouter = Router();
vendorProfileRouter.use(vendorOnly);

vendorProfileRouter.get("/", async (req: Request, res: Response) => {
  res.json(ok(await service.getVendorProfile(requireVendorId(req))));
});

vendorProfileRouter.patch("/", async (req: Request, res: Response) => {
  res.json(ok(await service.updateVendorProfile(requireVendorId(req), vendorProfileUpdateSchema.parse(req.body), actorOf(req))));
});

export const vendorStaffRouter = Router();
vendorStaffRouter.use(vendorOnly);
vendorStaffRouter.use(tradingForWrites);

vendorStaffRouter.get("/", async (req: Request, res: Response) => {
  res.json(ok(await service.listStaff(requireVendorId(req))));
});

vendorStaffRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.addStaff(requireVendorId(req), staffInputSchema.parse(req.body), actorOf(req))));
});

vendorStaffRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.removeStaff(requireVendorId(req), id, actorOf(req));
  res.status(204).end();
});

/** Admin: /admin/vendors */
export const adminVendorsRouter = Router();
adminVendorsRouter.use(adminOnly);

adminVendorsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listVendorsAdmin(vendorListQuery.parse(req.query));
  res.json(ok(items, meta));
});

adminVendorsRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.adminCreateVendor(adminCreateVendorSchema.parse(req.body), actorOf(req))));
});

adminVendorsRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getVendorAdmin(id)));
});

adminVendorsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateVendorAdmin(id, adminVendorUpdateSchema.parse(req.body), actorOf(req))));
});

adminVendorsRouter.post("/:id/status", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.setVendorStatus(id, vendorStatusActionSchema.parse(req.body), actorOf(req))));
});
