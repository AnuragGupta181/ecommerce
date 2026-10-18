import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";

const csv = z
  .string()
  .optional()
  .transform((value) => (value ? value.split(",").map((part) => part.trim()).filter(Boolean) : undefined));

const boolQuery = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

export const productSorts = ["relevance", "popular", "price_asc", "price_desc", "newest", "discount", "rating"] as const;

export const productListQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
  brand: csv,
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  discount: z.coerce.number().int().min(0).max(100).optional(),
  inStock: boolQuery,
  featured: boolQuery,
  ids: csv,
  /** Shop page: only this vendor's listings, priced at that vendor. */
  vendor: z.string().trim().max(80).optional(),
  sort: z.enum(productSorts).default("relevance"),
});

export type ProductListQuery = z.infer<typeof productListQuery>;

export const suggestionsQuery = z.object({ q: z.string().trim().min(1).max(100) });

// ───────────────────────── admin ─────────────────────────

const paise = z.number().int().min(0);

export const variantInputSchema = z
  .object({
    id: z.string().optional(),
    sku: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(60).default("Default"),
    attributes: z.record(z.string(), z.string()).default({}),
    mrp: paise.min(1),
    price: paise.min(1),
    /** Only applied when creating a variant; existing stock changes go through inventory adjustments. */
    stock: z.number().int().min(0).default(0),
    lowStockThreshold: z.number().int().min(0).default(5),
    isActive: z.boolean().default(true),
  })
  .refine((variant) => variant.price <= variant.mrp, { message: "Price cannot exceed MRP", path: ["price"] });

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(80).optional(),
  description: z.string().max(10_000).default(""),
  highlights: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
  specs: z
    .array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(300) }))
    .max(40)
    .default([]),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
  categoryId: z.string().min(1),
  brandId: z.string().min(1).nullish(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  images: z
    .array(z.object({ url: z.string().trim().min(1), alt: z.string().trim().max(160).nullish() }))
    .max(10)
    .default([]),
  variants: z
    .array(variantInputSchema)
    .min(1, "Add at least one variant")
    .max(50)
    .refine((variants) => new Set(variants.map((v) => v.sku.toLowerCase())).size === variants.length, {
      message: "SKUs must be unique",
    }),
});

export const productUpdateSchema = productInputSchema.partial();

export const adminProductListQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  status: z.enum(["active", "inactive", "low_stock", "out_of_stock"]).optional(),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type AdminProductListQuery = z.infer<typeof adminProductListQuery>;
