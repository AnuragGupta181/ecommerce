import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ok, requireUser } from "../../lib/http.js";
import { authenticate } from "../../middleware/auth.js";
import { requestPoint } from "../geo/geo.js";
import * as service from "./wishlist.service.js";

const productIdParam = z.object({ productId: z.string().min(1) });

export const wishlistRouter = Router();
wishlistRouter.use(authenticate);

wishlistRouter.get("/", async (req: Request, res: Response) => {
  res.json(ok(await service.listWishlist(requireUser(req).userId, requestPoint(req))));
});

/** Lightweight id list so clients can paint heart icons without loading full cards. */
wishlistRouter.get("/ids", async (req: Request, res: Response) => {
  res.json(ok(await service.wishlistProductIds(requireUser(req).userId)));
});

wishlistRouter.put("/:productId", async (req: Request, res: Response) => {
  const { productId } = productIdParam.parse(req.params);
  await service.addToWishlist(requireUser(req).userId, productId);
  res.status(204).end();
});

wishlistRouter.delete("/:productId", async (req: Request, res: Response) => {
  const { productId } = productIdParam.parse(req.params);
  await service.removeFromWishlist(requireUser(req).userId, productId);
  res.status(204).end();
});
