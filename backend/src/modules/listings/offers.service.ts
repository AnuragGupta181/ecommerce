import type { Prisma } from "../../generated/prisma/client.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { approxRoadKm, type Point } from "../geo/geo.js";
import { shopHoursOf, shopStatus } from "../branches/shop-status.js";
import { quoteDelivery, termsOf } from "../pricing/delivery.js";

/** Why a shop can or cannot take this item right now, most useful first. */
export type OfferLabel = "AVAILABLE" | "OUT_OF_STOCK" | "CLOSED" | "TOO_FAR";

const SCARCE = 5;

export const offerBranchSelect = {
  id: true,
  name: true,
  lat: true,
  lng: true,
  isActive: true,
  isOnline: true,
  offlineMessage: true,
  opensAt: true,
  closesAt: true,
  deliveryRadiusKm: true,
  deliveryRatePerKm: true,
  minDeliveryFee: true,
  freeDeliveryAbove: true,
  vendor: { select: { id: true, slug: true, shopName: true, status: true, logoUrl: true } },
} satisfies Prisma.BranchSelect;

export type OfferBranch = Prisma.BranchGetPayload<{ select: typeof offerBranchSelect }>;

/** A shop's status and delivery terms as seen from the customer's point (null = unknown). */
export function describeShop(branch: OfferBranch, point: Point | null, now = new Date()) {
  const status = shopStatus(shopHoursOf(branch), now);
  const distanceKm = point ? approxRoadKm(point, branch) : null;
  const delivery = quoteDelivery(termsOf(branch), distanceKm);
  return {
    branchId: branch.id,
    branchName: branch.name,
    vendorId: branch.vendor.id,
    vendorSlug: branch.vendor.slug,
    vendorName: branch.vendor.shopName,
    logoUrl: branch.vendor.logoUrl,
    isOpen: status.state === "OPEN",
    statusMessage: status.message,
    distanceKm,
    deliveryFee: delivery.fee,
    freeDeliveryAbove: delivery.freeAbove,
    deliverable: delivery.deliverable,
  };
}

export type ShopView = ReturnType<typeof describeShop>;

type ListingWithBranch = { id: string; variantId: string; price: number; mrp: number; stock: number; isAvailable: boolean; branch: OfferBranch };

export function toOffer(listing: ListingWithBranch, point: Point | null, now = new Date()) {
  const shop = describeShop(listing.branch, point, now);
  const inStock = listing.stock > 0;
  const label: OfferLabel = !inStock ? "OUT_OF_STOCK" : !shop.isOpen ? "CLOSED" : !shop.deliverable ? "TOO_FAR" : "AVAILABLE";
  return {
    listingId: listing.id,
    variantId: listing.variantId,
    price: listing.price,
    mrp: listing.mrp,
    discountPercent: listing.mrp > listing.price ? Math.round(((listing.mrp - listing.price) / listing.mrp) * 100) : 0,
    inStock,
    // Exact stock is shown to customers ("3 left") only when scarce.
    stockLeft: inStock && listing.stock <= SCARCE ? listing.stock : null,
    label,
    shop,
  };
}

export type Offer = ReturnType<typeof toOffer>;

const labelRank: Record<OfferLabel, number> = { AVAILABLE: 0, CLOSED: 1, OUT_OF_STOCK: 2, TOO_FAR: 3 };

/** Available shops first, nearest first; with no location, cheapest first. */
export function rankOffers(offers: Offer[]): Offer[] {
  return [...offers].sort(
    (a, b) =>
      labelRank[a.label] - labelRank[b.label] ||
      (a.shop.distanceKm !== null && b.shop.distanceKm !== null ? a.shop.distanceKm - b.shop.distanceKm : 0) ||
      a.price + a.shop.deliveryFee - (b.price + b.shop.deliveryFee),
  );
}

/** Listings customers may see: available listings of approved vendors' active shops. */
export const visibleListingWhere: Prisma.BranchVariantStockWhereInput = {
  isAvailable: true,
  branch: { isActive: true, vendor: { status: "APPROVED" } },
};

export async function loadOffers(db: Db, variantIds: string[], point: Point | null, now = new Date()) {
  if (variantIds.length === 0) return new Map<string, Offer[]>();
  const listings = await db.branchVariantStock.findMany({
    where: { ...visibleListingWhere, variantId: { in: variantIds } },
    select: { id: true, variantId: true, price: true, mrp: true, stock: true, isAvailable: true, branch: { select: offerBranchSelect } },
  });
  const byVariant = new Map<string, Offer[]>();
  for (const listing of listings) {
    const list = byVariant.get(listing.variantId) ?? [];
    list.push(toOffer(listing, point, now));
    byVariant.set(listing.variantId, list);
  }
  for (const [variantId, list] of byVariant) byVariant.set(variantId, rankOffers(list));
  return byVariant;
}

/** Every shop selling this variant, ranked; the first one is the default pick. */
export async function offersForVariant(variantId: string, point: Point | null) {
  return (await loadOffers(prisma, [variantId], point)).get(variantId) ?? [];
}

/** The listing the cart should use when the customer did not choose a shop. */
export async function defaultListing(db: Db, variantId: string, point: Point | null) {
  const offers = (await loadOffers(db, [variantId], point)).get(variantId) ?? [];
  return offers.find((offer) => offer.label === "AVAILABLE") ?? null;
}
