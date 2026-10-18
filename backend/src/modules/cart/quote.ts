import type { Coupon } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import type { Db } from "../../lib/prisma.js";
import { resolveCoupon, toPricingCoupon } from "../coupons/coupons.service.js";
import { deliveryDistanceKm, type Point } from "../geo/geo.js";
import { describeShop, offerBranchSelect, type OfferBranch, type ShopView } from "../listings/offers.service.js";
import { quoteDelivery, termsOf } from "../pricing/delivery.js";
import { calculatePricing, type PriceSummary } from "../pricing/pricing.js";
import { getSettings } from "../settings/settings.service.js";

export const MAX_QTY_PER_LINE = 10;

export type RequestedLine = { variantId: string; quantity: number; cartItemId?: string };

const variantSelect = {
  id: true,
  sku: true,
  label: true,
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

export type QuoteLine = Awaited<ReturnType<typeof loadLines>>[number];

/**
 * Prices the requested lines from one shop's listings and flags anything that shop
 * can't sell right now. The prices are the shop's own, never the catalog reference price.
 */
export async function loadLines(db: Db, branchId: string, requested: RequestedLine[]) {
  const variantIds = requested.map((line) => line.variantId);
  const [variants, listings] = await Promise.all([
    db.productVariant.findMany({ where: { id: { in: variantIds } }, select: variantSelect }),
    db.branchVariantStock.findMany({
      where: { branchId, variantId: { in: variantIds } },
      select: { id: true, variantId: true, price: true, mrp: true, stock: true, isAvailable: true },
    }),
  ]);
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const listingByVariant = new Map(listings.map((listing) => [listing.variantId, listing]));

  return requested.flatMap((line) => {
    const variant = variantById.get(line.variantId);
    if (!variant) return [];
    const listing = listingByVariant.get(line.variantId);
    const stock = listing?.stock ?? 0;
    const unavailableReason = !variant.isActive || !variant.product.isActive
      ? "No longer available"
      : !listing || !listing.isAvailable
        ? "Not sold at this shop"
        : stock <= 0
          ? "Out of stock"
          : stock < line.quantity
            ? `Only ${stock} left`
            : null;
    const price = listing?.price ?? 0;
    const mrp = listing?.mrp ?? 0;
    return [
      {
        id: line.cartItemId ?? variant.id,
        listingId: listing?.id ?? null,
        quantity: line.quantity,
        maxQuantity: Math.max(0, Math.min(stock, MAX_QTY_PER_LINE)),
        available: unavailableReason === null,
        unavailableReason,
        lineMrp: mrp * line.quantity,
        lineTotal: price * line.quantity,
        variant: { id: variant.id, sku: variant.sku, label: variant.label, mrp, price },
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

export async function loadShop(db: Db, branchId: string): Promise<OfferBranch> {
  const branch = await db.branch.findUnique({ where: { id: branchId }, select: offerBranchSelect });
  if (!branch) throw AppError.notFound("Shop");
  return branch;
}

export type QuoteOptions = { couponCode?: string; useCoins?: boolean };

export type Quote = {
  lines: QuoteLine[];
  summary: PriceSummary;
  coupon: Coupon | null;
  shop: ShopView;
  distanceKm: number | null;
  deliverable: boolean;
};

/**
 * Prices the available lines for one shop and destination.
 * `strict` (checkout) turns any coupon problem into an error; otherwise it is reported in `summary.couponError`.
 */
export async function buildQuote(
  db: Db,
  userId: string,
  branch: OfferBranch,
  destination: Point | null,
  lines: QuoteLine[],
  { couponCode, useCoins = false }: QuoteOptions,
  strict = false,
): Promise<Quote> {
  const [settings, user, distanceKm] = await Promise.all([
    getSettings(db),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { coinBalance: true } }),
    destination ? deliveryDistanceKm(branch, destination) : Promise.resolve(null),
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

  const delivery = quoteDelivery(termsOf(branch), distanceKm);
  const summary = calculatePricing({
    lines: lines.filter((line) => line.available).map((line) => ({ ...line.variant, quantity: line.quantity })),
    coupon: coupon ? toPricingCoupon(coupon) : null,
    coinBalance: user.coinBalance,
    useCoins,
    settings,
    delivery: { fee: delivery.fee, freeAbove: delivery.freeAbove },
  });

  if (strict && summary.couponError) throw new AppError("COUPON_INVALID", summary.couponError);
  if (resolveError) summary.couponError = resolveError;

  const shop = describeShop(branch, destination);
  return {
    lines,
    summary,
    coupon: summary.couponCode ? coupon : null,
    shop: { ...shop, distanceKm, deliveryFee: delivery.fee, deliverable: delivery.deliverable },
    distanceKm,
    deliverable: delivery.deliverable,
  };
}
