import { Router, type Request, type Response } from "express";
import { idParam, ok } from "../../lib/http.js";
import { adminOnly } from "../../middleware/auth.js";
import { brandInputSchema, brandUpdateSchema } from "./brands.schema.js";
import * as service from "./brands.service.js";

export const brandsRouter = Router();

brandsRouter.get("/", async (_req: Request, res: Response) => {
  res.json(ok(await service.listActiveBrands()));
});

export const adminBrandsRouter = Router();
adminBrandsRouter.use(adminOnly);

adminBrandsRouter.get("/", async (_req: Request, res: Response) => {
  res.json(ok(await service.listBrandsAdmin()));
});

adminBrandsRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createBrand(brandInputSchema.parse(req.body))));
});

adminBrandsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateBrand(id, brandUpdateSchema.parse(req.body))));
});

adminBrandsRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.deleteBrand(id);
  res.status(204).end();
});
