import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";

export const stockAdjustSchema = z.object({
  mode: z.enum(["IN", "OUT", "SET"]),
  quantity: z.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(2, "Add a reason for the stock log").max(200),
});

export const listingStockQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "in", "low", "out"]).default("all"),
  branchId: z.string().optional(),
  categoryId: z.string().optional(),
  sort: z.enum(["name", "stock"]).default("name"),
  /** Admin only: which vendor's stock to view. */
  vendorId: z.string().optional(),
});

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
export type ListingStockQuery = z.infer<typeof listingStockQuery>;
