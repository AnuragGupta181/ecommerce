import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok } from "../../lib/http.js";
import { adminOnly } from "../../middleware/auth.js";
import { bannerInputSchema, bannerUpdateSchema } from "./banners.schema.js";
import * as service from "./banners.service.js";

export const bannersRouter = Router();

bannersRouter.get("/", async (req: Request, res: Response) => {
  const { placement } = z.object({ placement: z.enum(["HOME_CAROUSEL", "HOME_STRIP"]).optional() }).parse(req.query);
  res.json(ok(await service.listLiveBanners(placement)));
});

export const adminBannersRouter = Router();
adminBannersRouter.use(adminOnly);

adminBannersRouter.get("/", async (_req: Request, res: Response) => {
  res.json(ok(await service.listBannersAdmin()));
});

adminBannersRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createBanner(bannerInputSchema.parse(req.body))));
});

adminBannersRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateBanner(id, bannerUpdateSchema.parse(req.body))));
});

adminBannersRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.deleteBanner(id);
  res.status(204).end();
});
