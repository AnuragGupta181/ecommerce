import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

/** A shop location and how it delivers. Money is paise. */
export const branchInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(3).max(500),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: z.string().trim().max(20).nullish(),
  email: z.email().nullish(),
  deliveryRadiusKm: z.number().positive().max(100).default(5),
  deliveryRatePerKm: z.number().int().min(0).max(100_000).default(1000),
  minDeliveryFee: z.number().int().min(0).max(1_000_000).default(2000),
  freeDeliveryAbove: z.number().int().min(0).nullish(),
  opensAt: hhmm.nullish(),
  closesAt: hhmm.nullish(),
  offlineMessage: z.string().trim().max(200).nullish(),
});

export const branchUpdateSchema = branchInputSchema.partial().extend({ isActive: z.boolean().optional() });

export const setOnlineSchema = z.object({
  isOnline: z.boolean(),
  reason: z.string().trim().max(500).optional(),
  offlineMessage: z.string().trim().max(200).nullish(),
});

export const nearbyQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });

export type BranchInput = z.infer<typeof branchInputSchema>;
export type BranchUpdate = z.infer<typeof branchUpdateSchema>;
export type SetOnlineInput = z.infer<typeof setOnlineSchema>;
