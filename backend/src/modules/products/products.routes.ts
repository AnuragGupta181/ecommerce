import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok, requireUser } from "../../lib/http.js";
import { adminOnly, optionalAuth } from "../../middleware/auth.js";
import { requestPoint } from "../geo/geo.js";
import * as adminService from "./products.admin.service.js";
import {
  adminProductListQuery,
  productInputSchema,
  productListQuery,
  productUpdateSchema,
  suggestionsQuery,
} from "./products.schema.js";
import * as service from "./products.service.js";

const slugParam = z.object({ slug: z.string().min(1) });

export const productsRouter = Router();
productsRouter.use(optionalAuth);

productsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listProducts(productListQuery.parse(req.query), req.auth?.userId, requestPoint(req));
  res.json(ok(items, meta));
});

productsRouter.get("/facets", async (req: Request, res: Response) => {
  res.json(ok(await service.getFacets(productListQuery.parse(req.query))));
});

productsRouter.get("/suggestions", async (req: Request, res: Response) => {
  const { q } = suggestionsQuery.parse(req.query);
  res.json(ok(await service.getSuggestions(q)));
});

productsRouter.get("/trending-searches", async (_req: Request, res: Response) => {
  res.json(ok(await service.getTrendingSearches()));
});

productsRouter.get("/:slug", async (req: Request, res: Response) => {
  const { slug } = slugParam.parse(req.params);
  res.json(ok(await service.getProductDetail(slug, req.auth?.userId, requestPoint(req))));
});

productsRouter.get("/:slug/similar", async (req: Request, res: Response) => {
  const { slug } = slugParam.parse(req.params);
  res.json(ok(await service.getSimilarProducts(slug, req.auth?.userId, requestPoint(req))));
});

export const adminProductsRouter = Router();
adminProductsRouter.use(adminOnly);

adminProductsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await adminService.listProductsAdmin(adminProductListQuery.parse(req.query));
  res.json(ok(items, meta));
});

adminProductsRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await adminService.getProductAdmin(id)));
});

adminProductsRouter.post("/", async (req: Request, res: Response) => {
  const input = productInputSchema.parse(req.body);
  res.status(201).json(ok(await adminService.createProduct(input, requireUser(req).userId)));
});

adminProductsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const input = productUpdateSchema.parse(req.body);
  res.json(ok(await adminService.updateProduct(id, input, requireUser(req).userId)));
});

adminProductsRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await adminService.deleteProduct(id)));
});
