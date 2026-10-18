import { z } from "zod";
import { phoneSchema } from "../auth/auth.schema.js";

export const addressInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3, "Enter house no. and street").max(160),
  line2: z.string().trim().max(160).nullish(),
  landmark: z.string().trim().max(100).nullish(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  /** Delivery point from GPS or the map pin; drives distance and delivery fee. */
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  type: z.enum(["HOME", "WORK", "OTHER"]).default("HOME"),
  isDefault: z.boolean().default(false),
});

export const addressUpdateSchema = addressInputSchema.partial();

export type AddressInput = z.infer<typeof addressInputSchema>;
export type AddressUpdate = z.infer<typeof addressUpdateSchema>;
