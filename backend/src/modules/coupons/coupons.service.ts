import type { Coupon, Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { formatINR } from "../../lib/money.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";
import type { PricingCoupon } from "../pricing/pricing.js";
import type { AdminCouponListQuery, CouponInput, CouponUpdate } from "./coupons.schema.js";

const NON_CANCELLED = { notIn: ["CANCELLED" as const] };

function liveWhere(now = new Date()): Prisma.CouponWhereInput {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

function isExhausted(coupon: Coupon) {
  return coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit;
}

export function toPricingCoupon(coupon: Coupon): PricingCoupon {
  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    maxDiscount: coupon.maxDiscount,
    minOrderValue: coupon.minOrderValue,
  };
}

export function describeCoupon(coupon: Pick<Coupon, "type" | "value" | "maxDiscount" | "minOrderValue">): string {
  const benefit =
    coupon.type === "PERCENT"
      ? `${coupon.value}% off${coupon.maxDiscount ? ` up to ${formatINR(coupon.maxDiscount)}` : ""}`
      : `Flat ${formatINR(coupon.value)} off`;
  return coupon.minOrderValue > 0 ? `${benefit} on orders above ${formatINR(coupon.minOrderValue)}` : benefit;
}

/** User-specific eligibility (limits, first order). Minimum order value is checked by the pricing engine. */
async function userIneligibility(db: Db, coupon: Coupon, userId: string): Promise<string | null> {
  if (isExhausted(coupon)) return "This coupon has been fully redeemed";
  const [usedByUser, priorOrders] = await Promise.all([
    db.couponRedemption.count({ where: { couponId: coupon.id, userId } }),
    coupon.firstOrderOnly ? db.order.count({ where: { userId, status: NON_CANCELLED } }) : Promise.resolve(0),
  ]);
  if (usedByUser >= coupon.perUserLimit) return "You have already used this coupon";
  if (coupon.firstOrderOnly && priorOrders > 0) return "This coupon is valid on your first order only";
  return null;
}

/** Resolves a code into a coupon the user may apply, or throws COUPON_INVALID with a shopper-friendly reason. */
export async function resolveCoupon(db: Db, code: string, userId: string): Promise<Coupon> {
  const coupon = await db.coupon.findFirst({ where: { code: code.toUpperCase(), ...liveWhere() } });
  if (!coupon) throw new AppError("COUPON_INVALID", "This coupon is invalid or has expired");
  const reason = await userIneligibility(db, coupon, userId);
  if (reason) throw new AppError("COUPON_INVALID", reason);
  return coupon;
}

/** Offers shown on product pages (no user context). */
export async function listPublicCoupons(limit = 10) {
  const coupons = await prisma.coupon.findMany({
    where: liveWhere(),
    orderBy: [{ firstOrderOnly: "desc" }, { createdAt: "desc" }],
    take: limit * 2,
  });
  return coupons
    .filter((coupon) => !isExhausted(coupon))
    .slice(0, limit)
    .map((coupon) => ({
      code: coupon.code,
      title: describeCoupon(coupon),
      description: coupon.description,
      firstOrderOnly: coupon.firstOrderOnly,
      endsAt: coupon.endsAt,
    }));
}

/** Coupons for the cart's "Apply coupon" sheet, flagged with whether they apply right now. */
export async function listCouponsForUser(userId: string, itemsTotal: number) {
  const coupons = await prisma.coupon.findMany({ where: liveWhere(), orderBy: { createdAt: "desc" } });
  const results = await Promise.all(
    coupons.map(async (coupon) => {
      const reason =
        (await userIneligibility(prisma, coupon, userId)) ??
        (itemsTotal < coupon.minOrderValue
          ? `Add items worth ${formatINR(coupon.minOrderValue - itemsTotal)} more`
          : null);
      return {
        code: coupon.code,
        title: describeCoupon(coupon),
        description: coupon.description,
        minOrderValue: coupon.minOrderValue,
        endsAt: coupon.endsAt,
        applicable: reason === null,
        reason,
      };
    }),
  );
  // Fully used / first-order-only coupons are noise for this user; keep only "add more" hints.
  return results
    .filter((coupon) => coupon.applicable || coupon.reason?.startsWith("Add items"))
    .sort((a, b) => Number(b.applicable) - Number(a.applicable));
}

// ───────────────────────── admin ─────────────────────────

export async function listCouponsAdmin(query: AdminCouponListQuery) {
  const now = new Date();
  const and: Prisma.CouponWhereInput[] = [];
  if (query.q) and.push({ OR: [{ code: { contains: query.q, mode: "insensitive" } }, { description: { contains: query.q, mode: "insensitive" } }] });
  if (query.status === "active") and.push(liveWhere(now));
  if (query.status === "inactive") and.push({ isActive: false });
  if (query.status === "expired") and.push({ endsAt: { lt: now } });

  const where: Prisma.CouponWhereInput = { AND: and };
  const [items, total] = await Promise.all([
    prisma.coupon.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(query) }),
    prisma.coupon.count({ where }),
  ]);
  return { items: items.map((coupon) => ({ ...coupon, summary: describeCoupon(coupon) })), meta: pageMeta(query, total) };
}

export async function getCouponAdmin(id: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      redemptions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } }, order: { select: { orderNumber: true } } },
      },
    },
  });
  if (!coupon) throw AppError.notFound("Coupon");
  return coupon;
}

export function createCoupon(input: CouponInput) {
  return prisma.coupon.create({ data: input });
}

export function updateCoupon(id: string, input: CouponUpdate) {
  return prisma.coupon.update({ where: { id }, data: input });
}

/** Coupons already redeemed are deactivated rather than deleted to keep order history intact. */
export async function deleteCoupon(id: string) {
  const redemptions = await prisma.couponRedemption.count({ where: { couponId: id } });
  if (redemptions > 0) {
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    return { archived: true };
  }
  await prisma.coupon.delete({ where: { id } });
  return { archived: false };
}
