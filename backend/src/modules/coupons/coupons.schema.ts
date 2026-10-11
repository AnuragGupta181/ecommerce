import { z } from "zod";
import { paginationQuery } from "../../lib/pagination.js";

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,20}$/, "Codes use 3-20 letters, numbers, - or _");

const couponBase = z.object({
  code: couponCodeSchema,
  description: z.string().trim().max(200).default(""),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.number().int().min(1),
  maxDiscount: z.number().int().min(1).nullish(),
  minOrderValue: z.number().int().min(0).default(0),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
  usageLimit: z.number().int().min(1).nullish(),
  perUserLimit: z.number().int().min(1).default(1),
  firstOrderOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type CouponShape = Partial<z.infer<typeof couponBase>>;

const couponRules = (coupon: CouponShape, ctx: z.RefinementCtx) => {
  if (coupon.type === "PERCENT" && coupon.value !== undefined && coupon.value > 100) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage cannot exceed 100" });
  }
  if (coupon.startsAt && coupon.endsAt && coupon.endsAt <= coupon.startsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End date must be after start date" });
  }
};

export const couponInputSchema = couponBase.superRefine(couponRules);
export const couponUpdateSchema = couponBase.partial().superRefine(couponRules);

export const adminCouponListQuery = paginationQuery.extend({
  q: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "expired"]).optional(),
});

export const applyCouponSchema = z.object({ code: couponCodeSchema });

export type CouponInput = z.infer<typeof couponInputSchema>;
export type CouponUpdate = z.infer<typeof couponUpdateSchema>;
export type AdminCouponListQuery = z.infer<typeof adminCouponListQuery>;
