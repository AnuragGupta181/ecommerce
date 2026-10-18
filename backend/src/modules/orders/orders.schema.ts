import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";
import { couponCodeSchema } from "../coupons/coupons.schema.js";
import { MAX_QTY_PER_LINE } from "../cart/quote.js";

const orderStatus = z.enum([
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "RIDER_ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
  "RETURN_REJECTED",
]);

const checkoutBase = {
  couponCode: couponCodeSchema.optional(),
  useCoins: z.boolean().default(false),
  /** "Buy now" bypasses the cart with explicit lines. */
  items: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE) }))
    .min(1)
    .max(20)
    .optional(),
  /** Shop for "buy now" lines; the cart's own shop is used otherwise. */
  branchId: z.string().min(1).optional(),
};

export const quoteSchema = z.object({ ...checkoutBase, addressId: z.string().min(1).optional() });

export const placeOrderSchema = z.object({
  ...checkoutBase,
  addressId: z.string().min(1),
  paymentMethod: z.enum(["COD", "UPI_ON_DELIVERY"]),
  note: z.string().trim().max(300).optional(),
});

export const cancelOrderSchema = z.object({ reason: z.string().trim().min(3).max(300) });
export const returnRequestSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export const customerOrderListQuery = paginationQuery.extend({
  status: z.enum(["active", "delivered", "cancelled", "returns"]).optional(),
});

export const adminOrderListQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: orderStatus.optional(),
  riderId: z.string().optional(),
  vendorId: z.string().optional(),
  branchId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const updateStatusSchema = z.object({
  status: orderStatus,
  note: z.string().trim().max(300).optional(),
});

export const assignRiderSchema = z.object({
  riderId: z.string().min(1),
  note: z.string().trim().max(300).optional(),
});

export const adminNoteSchema = z.object({ adminNote: z.string().trim().max(1000) });

export type QuoteInput = z.infer<typeof quoteSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type CustomerOrderListQuery = z.infer<typeof customerOrderListQuery>;
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuery>;
