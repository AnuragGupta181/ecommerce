import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok, requireUser } from "../../lib/http.js";
import { adminOnly, authenticate } from "../../middleware/auth.js";
import { adminReviewListQuery, productReviewQuery, reviewInputSchema } from "./reviews.schema.js";
import * as service from "./reviews.service.js";

export const reviewsRouter = Router();

reviewsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listProductReviews(productReviewQuery.parse(req.query));
  res.json(ok(items, meta));
});

reviewsRouter.get("/mine", authenticate, async (req: Request, res: Response) => {
  res.json(ok(await service.listMyReviews(requireUser(req).userId)));
});

reviewsRouter.post("/", authenticate, async (req: Request, res: Response) => {
  const input = reviewInputSchema.parse(req.body);
  res.status(201).json(ok(await service.upsertReview(requireUser(req).userId, input)));
});

reviewsRouter.delete("/:id", authenticate, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.deleteOwnReview(requireUser(req).userId, id);
  res.status(204).end();
});

export const adminReviewsRouter = Router();
adminReviewsRouter.use(adminOnly);

adminReviewsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listReviewsAdmin(adminReviewListQuery.parse(req.query));
  res.json(ok(items, meta));
});

adminReviewsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { isHidden } = z.object({ isHidden: z.boolean() }).parse(req.body);
  res.json(ok(await service.setReviewHidden(id, isHidden)));
});

adminReviewsRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.deleteReviewAdmin(id);
  res.status(204).end();
});
