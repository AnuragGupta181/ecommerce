import type { Coupon } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import type { Db } from "../../lib/prisma.js";
import { resolveCoupon, toPricingCoupon } from "../coupons/coupons.service.js";
import { calculatePricing, type PriceSummary } from "../pricing/pricing.js";
import { getSettings } from "../settings/settings.service.js";

export const MAX_QTY_PER_LINE = 10;

const lineVariantSelect = {
  id: true,
  sku: true,
  label: true,
  mrp: true,
  price: true,
  stock: true,
  isActive: true,
  product: {
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      brand: { select: { name: true } },
      images: { take: 1, orderBy: { sortOrder: "asc" as const }, select: { url: true } },
    },
  },
} as const;

export type RequestedLine = { variantId: string; quantity: number; cartItemId?: string };

export type QuoteLine = Awaited<ReturnType<typeof loadLines>>[number];

/** Loads variants for the requested lines and flags anything that can't be bought right now. */
export async function loadLines(db: Db, requested: RequestedLine[]) {
  const variants = await db.productVariant.findMany({
    where: { id: { in: requested.map((line) => line.variantId) } },
    select: lineVariantSelect,
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  return requested.flatMap((line) => {
    const variant = byId.get(line.variantId);
    if (!variant) return [];
    const unavailableReason = !variant.isActive || !variant.product.isActive
      ? "No longer available"
      : variant.stock <= 0
        ? "Out of stock"
        : variant.stock < line.quantity
          ? `Only ${variant.stock} left`
          : null;
    return [
      {
        id: line.cartItemId ?? variant.id,
        quantity: line.quantity,
        maxQuantity: Math.max(0, Math.min(variant.stock, MAX_QTY_PER_LINE)),
        available: unavailableReason === null,
        unavailableReason,
        lineMrp: variant.mrp * line.quantity,
        lineTotal: variant.price * line.quantity,
        variant: { id: variant.id, sku: variant.sku, label: variant.label, mrp: variant.mrp, price: variant.price },
        product: {
          id: variant.product.id,
          slug: variant.product.slug,
          name: variant.product.name,
          brand: variant.product.brand?.name ?? null,
          imageUrl: variant.product.images[0]?.url ?? null,
        },
      },
    ];
  });
}

export type QuoteOptions = { couponCode?: string; useCoins?: boolean };

export type Quote = { lines: QuoteLine[]; summary: PriceSummary; coupon: Coupon | null };

/**
 * Prices the available lines.
 * `strict` (checkout) turns any coupon problem into an error; otherwise it is reported in `summary.couponError`.
 */
export async function buildQuote(
  db: Db,
  userId: string,
  lines: QuoteLine[],
  { couponCode, useCoins = false }: QuoteOptions,
  strict = false,
): Promise<Quote> {
  const [settings, user] = await Promise.all([
    getSettings(db),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { coinBalance: true } }),
  ]);

  let coupon: Coupon | null = null;
  let resolveError: string | null = null;
  if (couponCode) {
    try {
      coupon = await resolveCoupon(db, couponCode, userId);
    } catch (error) {
      if (strict || !(error instanceof AppError)) throw error;
      resolveError = error.message;
    }
  }

  const summary = calculatePricing({
    lines: lines.filter((line) => line.available).map((line) => ({ ...line.variant, quantity: line.quantity })),
    coupon: coupon ? toPricingCoupon(coupon) : null,
    coinBalance: user.coinBalance,
    useCoins,
    settings,
  });

  if (strict && summary.couponError) throw new AppError("COUPON_INVALID", summary.couponError);
  if (resolveError) summary.couponError = resolveError;

  return { lines, summary, coupon: summary.couponCode ? coupon : null };
}
