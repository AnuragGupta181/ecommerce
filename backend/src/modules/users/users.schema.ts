import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";
import { phoneSchema } from "../auth/auth.schema.js";

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: phoneSchema,
    avatarUrl: z.string().trim().min(1).nullable(),
  })
  .partial();

export const customerListQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  blocked: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

export const coinAdjustSchema = z.object({
  amount: z
    .number()
    .int()
    .refine((value) => value !== 0, "Amount cannot be zero")
    .refine((value) => Math.abs(value) <= 100_000, "Amount is too large"),
  note: z.string().trim().min(3).max(200),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuery>;
