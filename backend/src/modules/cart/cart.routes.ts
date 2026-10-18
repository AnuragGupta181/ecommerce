import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok, requireUser } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { couponCodeSchema } from "../coupons/coupons.schema.js";
import { requestPoint } from "../geo/geo.js";
import * as service from "./cart.service.js";
import { MAX_QTY_PER_LINE } from "./quote.js";

const quantity = z.number().int().min(1).max(MAX_QTY_PER_LINE);

const cartQuery = z.object({
  coupon: couponCodeSchema.optional(),
  useCoins: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const addItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: quantity.default(1),
  /** The shop the customer picked; omitted = the best shop for their location. */
  branchId: z.string().min(1).optional(),
  /** Confirms "start a new cart from this shop" after a CART_SHOP_CONFLICT. */
  replaceCart: z.boolean().default(false),
});

export const cartRouter = Router();
cartRouter.use(authenticate);

cartRouter.get("/", async (req: Request, res: Response) => {
  const { coupon, useCoins } = cartQuery.parse(req.query);
  res.json(ok(await service.getCart(requireUser(req).userId, { couponCode: coupon, useCoins }, requestPoint(req))));
});

cartRouter.get("/count", async (req: Request, res: Response) => {
  res.json(ok(await service.getCartCount(requireUser(req).userId)));
});

cartRouter.get("/coupons", async (req: Request, res: Response) => {
  res.json(ok(await service.getCartCoupons(requireUser(req).userId)));
});

cartRouter.get("/shops", async (req: Request, res: Response) => {
  res.json(ok(await service.cartShopOptions(requireUser(req).userId, requestPoint(req))));
});

cartRouter.post("/shop", async (req: Request, res: Response) => {
  const { branchId } = z.object({ branchId: z.string().min(1) }).parse(req.body);
  await service.switchCartShop(requireUser(req).userId, branchId);
  res.status(204).end();
});

cartRouter.post("/items", async (req: Request, res: Response) => {
  const body = addItemSchema.parse(req.body);
  res.status(201).json(ok(await service.addItem(requireUser(req).userId, body, requestPoint(req))));
});

cartRouter.patch("/items/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const body = z.object({ quantity }).parse(req.body);
  await service.updateItem(requireUser(req).userId, id, body.quantity);
  res.status(204).end();
});

cartRouter.delete("/items/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.removeItem(requireUser(req).userId, id);
  res.status(204).end();
});

cartRouter.post("/items/:id/save-for-later", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.moveToWishlist(requireUser(req).userId, id);
  res.status(204).end();
});

cartRouter.delete("/", async (req: Request, res: Response) => {
  await service.clearCart(requireUser(req).userId);
  res.status(204).end();
});
