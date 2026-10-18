import { Router, type Request, type Response } from "express";
import { idParam, ok, requireUser, requireVendorId } from "../../lib/http.js";
import { paginationQuery } from "../../lib/pagination.js";
import { adminOnly, optionalAuth, vendorOnly } from "../../middleware/auth.js";
import { listingStockQuery, stockAdjustSchema } from "../branch-stock/branch-stock.schema.js";
import * as stock from "../branch-stock/branch-stock.service.js";
import { requestPoint } from "../geo/geo.js";
import { catalogSearchQuery, listingCreateSchema, listingUpdateSchema, offersQuery, vendorProductSchema, vendorProductUpdateSchema } from "./listings.schema.js";
import * as service from "./listings.service.js";
import { offersForVariant } from "./offers.service.js";
import { tradingForWrites } from "../vendors/vendor-guard.js";

const actorOf = (req: Request) => {
  const auth = requireUser(req);
  return { id: auth.userId, role: auth.role, vendorId: auth.vendorId };
};

/** Public: /offers?variantId= — every shop selling a variant, ranked for the shopper's location. */
export const offersRouter = Router();
offersRouter.get("/", optionalAuth, async (req: Request, res: Response) => {
  const { variantId } = offersQuery.parse(req.query);
  res.json(ok(await offersForVariant(variantId, requestPoint(req))));
});

/** Vendor portal: /vendor/listings (price, cost and stock of the shop's items) */
export const vendorListingsRouter = Router();
vendorListingsRouter.use(vendorOnly);
vendorListingsRouter.use(tradingForWrites);

vendorListingsRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await stock.listListings({ vendorId: requireVendorId(req) }, listingStockQuery.parse(req.query), { includeCost: true });
  res.json(ok(items, meta));
});

vendorListingsRouter.get("/summary", async (req: Request, res: Response) => {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  res.json(ok(await stock.stockSummary({ vendorId: requireVendorId(req), branchId })));
});

vendorListingsRouter.get("/catalog", async (req: Request, res: Response) => {
  const { items, meta } = await service.searchCatalog(requireVendorId(req), catalogSearchQuery.parse(req.query));
  res.json(ok(items, meta));
});

vendorListingsRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createListing(requireVendorId(req), listingCreateSchema.parse(req.body), actorOf(req))));
});

vendorListingsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateListing(requireVendorId(req), id, listingUpdateSchema.parse(req.body), actorOf(req))));
});

vendorListingsRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.deleteListing(requireVendorId(req), id, actorOf(req))));
});

vendorListingsRouter.post("/:id/adjust", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await stock.adjustListingStock(requireVendorId(req), id, stockAdjustSchema.parse(req.body), actorOf(req))));
});

vendorListingsRouter.get("/:id/movements", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { items, meta } = await stock.listListingMovements({ vendorId: requireVendorId(req) }, id, paginationQuery.parse(req.query));
  res.json(ok(items, meta));
});

/** Vendor portal: /vendor/products (catalog products the shop created itself) */
export const vendorProductsRouter = Router();
vendorProductsRouter.use(vendorOnly);
vendorProductsRouter.use(tradingForWrites);

vendorProductsRouter.post("/", async (req: Request, res: Response) => {
  res.status(201).json(ok(await service.createVendorProduct(requireVendorId(req), vendorProductSchema.parse(req.body), actorOf(req))));
});

vendorProductsRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getVendorProduct(requireVendorId(req), id)));
});

vendorProductsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.updateVendorProduct(requireVendorId(req), id, vendorProductUpdateSchema.parse(req.body), actorOf(req))));
});

/** Admin: /admin/inventory — read-only view of any vendor's stock (pick vendor, then branch). */
export const adminInventoryRouter = Router();
adminInventoryRouter.use(adminOnly);

adminInventoryRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await stock.listListings({}, listingStockQuery.parse(req.query), { includeCost: false });
  res.json(ok(items, meta));
});

adminInventoryRouter.get("/summary", async (req: Request, res: Response) => {
  const vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  res.json(ok(await stock.stockSummary({ vendorId, branchId })));
});

adminInventoryRouter.get("/listings/:id/movements", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { items, meta } = await stock.listListingMovements({}, id, paginationQuery.parse(req.query));
  res.json(ok(items, meta));
});
