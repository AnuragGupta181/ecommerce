import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok } from "../../lib/http.js";
import { adminOnly } from "../../middleware/auth.js";
import { categoryInputSchema, categoryUpdateSchema } from "./categories.schema.js";
import * as service from "./categories.service.js";

const slugParam = z.object({ slug: z.string().min(1) });

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req: Request, res: Response) => {
  res.json(ok(await service.getCategoryTree()));
});

categoriesRouter.get("/:slug", async (req: Request, res: Response) => {
  const { slug } = slugParam.parse(req.params);
  res.json(ok(await service.getCategoryBySlug(slug)));
});

export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(adminOnly);

adminCategoriesRouter.get("/", async (_req: Request, res: Response) => {
  res.json(ok(await service.listCategoriesAdmin()));
});

adminCategoriesRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createCategory(categoryInputSchema.parse(req.body))));
});

adminCategoriesRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateCategory(id, categoryUpdateSchema.parse(req.body))));
});

adminCategoriesRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await service.deleteCategory(id);
  res.status(204).end();
});
