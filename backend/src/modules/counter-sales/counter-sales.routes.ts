import { Router, type Request, type Response } from "express";
import { idParam, ok, requireUser, requireVendorId } from "../../lib/http.js";
import { vendorOnly } from "../../middleware/auth.js";
import { counterSaleListQuery, counterSaleSchema, createCounterSale, getCounterSale, listCounterSales } from "./counter-sales.service.js";
import { tradingForWrites } from "../vendors/vendor-guard.js";

/** Vendor portal: /vendor/counter-sales */
export const vendorCounterSalesRouter = Router();
vendorCounterSalesRouter.use(vendorOnly);
vendorCounterSalesRouter.use(tradingForWrites);

vendorCounterSalesRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await listCounterSales(requireVendorId(req), counterSaleListQuery.parse(req.query));
  res.json(ok(items, meta));
});

vendorCounterSalesRouter.post("/", async (req: Request, res: Response) => {
  const auth = requireUser(req);
  const sale = await createCounterSale(requireVendorId(req), counterSaleSchema.parse(req.body), { id: auth.userId, role: auth.role, vendorId: auth.vendorId });
  res.status(201).json(ok(sale));
});

vendorCounterSalesRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await getCounterSale(requireVendorId(req), id)));
});
