import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";
import { passwordSchema, phoneSchema } from "../auth/auth.schema.js";
import { branchInputSchema } from "../branches/branch.schema.js";

const email = z.email().trim().toLowerCase();

export const ownerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  phone: phoneSchema,
  password: passwordSchema,
});

export const vendorProfileSchema = z.object({
  shopName: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).default(""),
  logoUrl: z.string().trim().max(500).nullish(),
  phone: phoneSchema,
  email,
  address: z.string().trim().min(5).max(300),
  gstin: z.string().trim().toUpperCase().max(20).nullish(),
  idProofType: z.string().trim().max(40).nullish(),
  idProofNumber: z.string().trim().max(40).nullish(),
  idProofUrl: z.string().trim().max(500).nullish(),
  payoutUpi: z.string().trim().max(100).nullish(),
  payoutDetails: z.string().trim().max(500).nullish(),
});

/** Public signup: the owner login, the shop and its first branch. Starts PENDING. */
export const vendorSignupSchema = z.object({
  owner: ownerSchema,
  shop: vendorProfileSchema,
  branch: branchInputSchema,
});

/** Admin-created vendors are approved straight away and can have a custom commission. */
export const adminCreateVendorSchema = vendorSignupSchema.extend({
  commissionBps: z.number().int().min(0).max(5000).default(1000),
  subscriptionsEnabled: z.boolean().default(false),
});

export const vendorProfileUpdateSchema = vendorProfileSchema.partial().extend({
  subscriptionsEnabled: z.boolean().optional(),
});

export const adminVendorUpdateSchema = vendorProfileUpdateSchema.extend({
  commissionBps: z.number().int().min(0).max(5000).optional(),
});

export const vendorStatusActionSchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "reactivate"]),
  reason: z.string().trim().max(500).optional(),
});

export const vendorListQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
});

export const staffInputSchema = ownerSchema;

export type VendorSignupInput = z.infer<typeof vendorSignupSchema>;
export type AdminCreateVendorInput = z.infer<typeof adminCreateVendorSchema>;
export type VendorProfileUpdate = z.infer<typeof vendorProfileUpdateSchema>;
export type AdminVendorUpdate = z.infer<typeof adminVendorUpdateSchema>;
export type VendorStatusAction = z.infer<typeof vendorStatusActionSchema>;
export type VendorListQuery = z.infer<typeof vendorListQuery>;
export type StaffInput = z.infer<typeof staffInputSchema>;
