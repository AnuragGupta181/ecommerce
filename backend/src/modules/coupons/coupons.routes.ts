import { Router, type Request, type Response } from "express";
import { idParam, ok } from "../../lib/http.js";
import { adminOnly } from "../../middleware/auth.js";
import { adminCouponListQuery, couponInputSchema, couponUpdateSchema } from "./coupons.schema.js";
import * as service from "./coupons.service.js";

export const couponsRouter = Router();

/** Public offers list; personalised availability is served with the cart (GET /cart/coupons). */
couponsRouter.get("/", async (_req: Request, res: Response) => {
  res.json(ok(await service.listPublicCoupons(20)));
});

export const adminCouponsRouter = Router();
adminCouponsRouter.use(adminOnly);

adminCouponsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listCouponsAdmin(adminCouponListQuery.parse(req.query));
  res.json(ok(items, meta));
});

adminCouponsRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getCouponAdmin(id)));
});

adminCouponsRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createCoupon(couponInputSchema.parse(req.body))));
});

adminCouponsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateCoupon(id, couponUpdateSchema.parse(req.body))));
});

adminCouponsRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.deleteCoupon(id)));
});
