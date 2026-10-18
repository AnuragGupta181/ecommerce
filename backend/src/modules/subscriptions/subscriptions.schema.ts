import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";
import { isIsoDate } from "../pricing/subscription.js";

const isoDate = z.string().refine(isIsoDate, "Use a YYYY-MM-DD date");
const paise = z.number().int().min(0);
/** Delivery weekdays as a bitmask: Mon = 1 … Sun = 64. */
const weekdays = z.number().int().min(1, "Pick at least one delivery day").max(127);

const planPriceSchema = z.object({
  period: z.enum(["WEEKLY", "MONTHLY"]),
  pricePerDelivery: paise.min(1),
  deliveryFee: paise.default(0),
  deliveryFeeMode: z.enum(["PER_DELIVERY", "PER_PERIOD"]).default("PER_DELIVERY"),
});

export const planInputSchema = z.object({
  listingId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default(""),
  quantityPerDelivery: z.number().int().min(1).max(100).default(1),
  slots: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  capacity: z.number().int().min(1).max(100_000).nullish(),
  isActive: z.boolean().default(true),
  prices: z
    .array(planPriceSchema)
    .min(1, "Offer at least a weekly or a monthly price")
    .max(2)
    .refine((rows) => new Set(rows.map((row) => row.period)).size === rows.length, "One price per period"),
});

export const planUpdateSchema = planInputSchema.partial();

export const subscribeSchema = z.object({
  planId: z.string().min(1),
  period: z.enum(["WEEKLY", "MONTHLY"]),
  startDate: isoDate,
  weekdays,
  quantity: z.number().int().min(1).max(20).default(1),
  slot: z.string().trim().max(40).optional(),
  /** "Advanced": specific dates inside the period with no delivery. */
  skipDates: z.array(isoDate).max(31).default([]),
  addressId: z.string().min(1),
  paymentPlan: z.enum(["UPFRONT", "TWO_INSTALMENTS", "END_OF_PERIOD"]).default("END_OF_PERIOD"),
});

export const subscriptionQuoteSchema = subscribeSchema.extend({ addressId: z.string().min(1).optional() });

export const skipSchema = z.object({ date: isoDate, skip: z.boolean().default(true) });
export const pauseSchema = z.object({ fromDate: isoDate, toDate: isoDate }).refine((value) => value.fromDate <= value.toDate, "The pause must end on or after it starts");
export const cancelSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export const plansQuery = paginationQuery.extend({ q: z.string().trim().max(100).optional(), vendor: z.string().max(80).optional() });

export const vendorSubscriptionQuery = paginationQuery.extend({
  status: z.enum(["ACTIVE", "CANCELLED", "COMPLETED"]).optional(),
  planId: z.string().optional(),
  q: z.string().trim().max(100).optional(),
});

export const deliveriesQuery = z.object({ date: isoDate.optional(), branchId: z.string().optional() });
export const markDeliveredSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });
export const markMissedSchema = z.object({ note: z.string().trim().min(2).max(200) });
export const assignSubscriptionRiderSchema = z.object({ riderId: z.string().min(1).nullable() });

export const paymentSchema = z.object({
  /** Negative records a refund. */
  amount: z.number().int().refine((value) => value !== 0, "Enter an amount"),
  method: z.enum(["CASH", "UPI", "OTHER"]).default("CASH"),
  note: z.string().trim().max(200).optional(),
});

export type PlanInput = z.infer<typeof planInputSchema>;
export type PlanUpdate = z.infer<typeof planUpdateSchema>;
export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type SubscriptionQuoteInput = z.infer<typeof subscriptionQuoteSchema>;
export type PlansQuery = z.infer<typeof plansQuery>;
export type VendorSubscriptionQuery = z.infer<typeof vendorSubscriptionQuery>;
export type PaymentInput = z.infer<typeof paymentSchema>;
