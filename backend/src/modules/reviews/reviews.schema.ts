import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";

export const reviewInputSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).nullish(),
  comment: z.string().trim().max(2000).nullish(),
});

export const productReviewQuery = paginationQuery.extend({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(["recent", "rating_high", "rating_low"]).default("recent"),
});

export const adminReviewListQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  hidden: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type ProductReviewQuery = z.infer<typeof productReviewQuery>;
export type AdminReviewListQuery = z.infer<typeof adminReviewListQuery>;
