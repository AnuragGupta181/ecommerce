import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";
import { productInputSchema, variantInputSchema } from "../products/products.schema.js";

const paise = z.number().int().min(0);

const listingTerms = {
  price: paise.min(1),
  mrp: paise.min(1),
  /** Private: what the vendor paid. Drives profit reports. */
  costPrice: paise.nullish(),
  lowStockThreshold: z.number().int().min(0).max(100_000).default(5),
  isAvailable: z.boolean().default(true),
};

const priceWithinMrp = (value: { price?: number; mrp?: number }) => value.price === undefined || value.mrp === undefined || value.price <= value.mrp;

/** List an existing catalog variant at one of the vendor's shops. */
export const listingCreateSchema = z
  .object({ branchId: z.string().min(1), variantId: z.string().min(1), stock: z.number().int().min(0).max(1_000_000).default(0), ...listingTerms })
  .refine(priceWithinMrp, { message: "Price cannot exceed MRP", path: ["price"] });

export const listingUpdateSchema = z
  .object({
    price: listingTerms.price.optional(),
    mrp: listingTerms.mrp.optional(),
    costPrice: listingTerms.costPrice,
    lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine(priceWithinMrp, { message: "Price cannot exceed MRP", path: ["price"] });

/** A new catalog product created by a vendor, listed at one of its shops in the same step. */
export const vendorProductSchema = productInputSchema.extend({
  branchId: z.string().min(1),
  variants: z
    .array(variantInputSchema.and(z.object({ costPrice: paise.nullish() })))
    .min(1, "Add at least one variant")
    .max(50),
});

export const vendorProductUpdateSchema = productInputSchema.omit({ variants: true }).partial();

export const catalogSearchQuery = paginationQuery.extend({
  q: z.string().trim().min(1).max(100),
  branchId: z.string().optional(),
});

export const offersQuery = z.object({ variantId: z.string().min(1) });

export type ListingCreate = z.infer<typeof listingCreateSchema>;
export type ListingUpdate = z.infer<typeof listingUpdateSchema>;
export type VendorProductInput = z.infer<typeof vendorProductSchema>;
export type VendorProductUpdate = z.infer<typeof vendorProductUpdateSchema>;
export type CatalogSearchQuery = z.infer<typeof catalogSearchQuery>;
