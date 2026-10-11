import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";

export const adjustStockSchema = z.object({
  mode: z.enum(["IN", "OUT", "SET"]),
  quantity: z.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(2, "Add a reason for the audit log").max(200),
});

export const thresholdSchema = z.object({ lowStockThreshold: z.number().int().min(0).max(100_000) });

export const inventoryListQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().optional(),
  status: z.enum(["all", "in", "low", "out"]).default("all"),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type InventoryListQuery = z.infer<typeof inventoryListQuery>;
