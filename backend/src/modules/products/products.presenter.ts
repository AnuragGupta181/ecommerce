import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { Point } from "../geo/geo.js";
import { loadOffers, rankOffers, type Offer } from "../listings/offers.service.js";

/** Minimal shape needed to render a product tile anywhere in the apps. */
export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  minPrice: true,
  minMrp: true,
  discountPercent: true,
  ratingAvg: true,
  ratingCount: true,
  isFeatured: true,
  brand: { select: { name: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
  variants: {
    where: { isActive: true },
    orderBy: [{ price: "asc" }, { sortOrder: "asc" }],
    select: { id: true },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

/** The shop a tile advertises: the best offer for this shopper across all variants. */
function tileShop(best: Offer | undefined) {
  if (!best) return null;
  return {
    vendorName: best.shop.vendorName,
    vendorSlug: best.shop.vendorSlug,
    distanceKm: best.shop.distanceKm,
    isOpen: best.shop.isOpen,
    label: best.label,
  };
}

export function toProductCard(row: CardRow, wishlisted: Set<string> = new Set(), offers: Offer[] = []) {
  const best = offers[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand?.name ?? null,
    imageUrl: row.images[0]?.url ?? null,
    price: best?.price ?? row.minPrice,
    mrp: best?.mrp ?? row.minMrp,
    discountPercent: best?.discountPercent ?? row.discountPercent,
    ratingAvg: Math.round(row.ratingAvg * 10) / 10,
    ratingCount: row.ratingCount,
    isFeatured: row.isFeatured,
    inStock: offers.some((offer) => offer.inStock),
    /** Lets clients add single-variant products to the cart straight from a tile. */
    defaultVariantId: row.variants.length === 1 ? (row.variants[0]?.id ?? null) : null,
    variantCount: row.variants.length,
    isWishlisted: wishlisted.has(row.id),
    shop: tileShop(best),
    shopCount: new Set(offers.map((offer) => offer.shop.branchId)).size,
  };
}

export type ProductCard = ReturnType<typeof toProductCard>;

/** Turns catalog rows into tiles priced from the shops near `point` (or the cheapest shops). */
export async function toProductCards(rows: CardRow[], wishlisted: Set<string>, point: Point | null, onlyVendorSlug?: string) {
  const variantIds = rows.flatMap((row) => row.variants.map((variant) => variant.id));
  const byVariant = await loadOffers(prisma, variantIds, point);
  return rows.map((row) => {
    const all = row.variants.flatMap((variant) => byVariant.get(variant.id) ?? []);
    const offers = rankOffers(onlyVendorSlug ? all.filter((offer) => offer.shop.vendorSlug === onlyVendorSlug) : all);
    return toProductCard(row, wishlisted, offers);
  });
}
