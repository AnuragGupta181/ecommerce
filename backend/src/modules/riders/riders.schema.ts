import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";
import { phoneSchema } from "../auth/auth.schema.js";

export const riderInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  whatsapp: phoneSchema.nullish(),
  email: z.email().trim().toLowerCase().nullish(),
  vehicleType: z.enum(["BIKE", "SCOOTER", "BICYCLE", "CAR", "VAN", "OTHER"]).default("BIKE"),
  vehicleNumber: z.string().trim().toUpperCase().max(20).nullish(),
  idProofType: z.string().trim().max(40).nullish(),
  idProofNumber: z.string().trim().max(40).nullish(),
  address: z.string().trim().max(300).nullish(),
  notes: z.string().trim().max(500).nullish(),
  isActive: z.boolean().default(true),
});

export const riderUpdateSchema = riderInputSchema.partial();

export const riderListQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

export type RiderInput = z.infer<typeof riderInputSchema>;
export type RiderUpdate = z.infer<typeof riderUpdateSchema>;
export type RiderListQuery = z.infer<typeof riderListQuery>;
