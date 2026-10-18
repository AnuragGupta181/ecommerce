import { AppError } from "../../lib/errors.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { listCouponsForUser } from "../coupons/coupons.service.js";
import { customerPoint } from "../geo/customer-point.js";
import type { Point } from "../geo/geo.js";
import { defaultListing, describeShop, offerBranchSelect, visibleListingWhere } from "../listings/offers.service.js";
import { buildQuote, loadLines, loadShop, MAX_QTY_PER_LINE, type QuoteOptions } from "./quote.js";

/**
 * A cart buys from exactly one shop (branch). Every line shares `CartItem.branchId`;
 * adding an item from another shop is a conflict the app resolves by starting a new cart.
 */

type CartRow = { id: string; variantId: string; quantity: number; branchId: string | null };

async function cartRows(db: Db, userId: string): Promise<CartRow[]> {
  return db.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, variantId: true, quantity: true, branchId: true },
  });
}

/** Carts from before shops existed have no branch; give them the best shop for their first item. */
async function cartBranchId(db: Db, userId: string, rows: CartRow[], point: Point | null): Promise<string | null> {
  const known = rows.find((row) => row.branchId)?.branchId;
  if (known) {
    if (rows.some((row) => !row.branchId)) await db.cartItem.updateMany({ where: { userId, branchId: null }, data: { branchId: known } });
    return known;
  }
  const first = rows[0];
  if (!first) return null;
  const offer = await defaultListing(db, first.variantId, point);
  if (!offer) return null;
  await db.cartItem.updateMany({ where: { userId }, data: { branchId: offer.shop.branchId } });
  return offer.shop.branchId;
}

export async function getCart(userId: string, options: QuoteOptions, browsing: Point | null) {
  const point = await customerPoint(prisma, userId, browsing);
  const rows = await cartRows(prisma, userId);
  const branchId = await cartBranchId(prisma, userId, rows, point);
  if (!branchId) return { shop: null, items: [], summary: emptySummary(), deliverable: true };

  const [branch, lines] = await Promise.all([
    loadShop(prisma, branchId),
    loadLines(prisma, branchId, rows.map((row) => ({ variantId: row.variantId, quantity: row.quantity, cartItemId: row.id }))),
  ]);
  const quote = await buildQuote(prisma, userId, branch, point, lines, options);
  return { shop: quote.shop, items: lines, summary: quote.summary, deliverable: quote.deliverable };
}

function emptySummary() {
  return {
    itemCount: 0,
    itemsMrp: 0,
    itemsTotal: 0,
    mrpDiscount: 0,
    couponCode: null,
    couponDiscount: 0,
    couponError: null,
    coinsAvailable: 0,
    coinsRedeemable: 0,
    coinsUsed: 0,
    coinsDiscount: 0,
    deliveryFee: 0,
    amountForFreeDelivery: 0,
    payable: 0,
    totalSavings: 0,
    coinsToEarn: 0,
  };
}

export async function getCartCount(userId: string) {
  const result = await prisma.cartItem.aggregate({ where: { userId }, _sum: { quantity: true } });
  return { count: result._sum.quantity ?? 0 };
}

export async function getCartCoupons(userId: string) {
  const rows = await cartRows(prisma, userId);
  const branchId = rows.find((row) => row.branchId)?.branchId;
  const lines = branchId ? await loadLines(prisma, branchId, rows) : [];
  const itemsTotal = lines.filter((line) => line.available).reduce((sum, line) => sum + line.lineTotal, 0);
  return listCouponsForUser(userId, itemsTotal);
}

async function assertListingStock(branchId: string, variantId: string, quantity: number) {
  const listing = await prisma.branchVariantStock.findFirst({
    where: { ...visibleListingWhere, branchId, variantId, variant: { isActive: true, product: { isActive: true } } },
    select: { stock: true },
  });
  if (!listing) throw AppError.notFound("This item at this shop");
  if (listing.stock <= 0) throw new AppError("OUT_OF_STOCK", "This item is out of stock at this shop");
  if (quantity > listing.stock) throw new AppError("OUT_OF_STOCK", `Only ${listing.stock} left at this shop`);
}

export type AddItemInput = { variantId: string; quantity: number; branchId?: string; replaceCart?: boolean };

export async function addItem(userId: string, input: AddItemInput, browsing: Point | null) {
  let branchId = input.branchId;
  if (!branchId) {
    const point = await customerPoint(prisma, userId, browsing);
    const offer = await defaultListing(prisma, input.variantId, point);
    if (!offer) throw new AppError("OUT_OF_STOCK", "No shop near you has this right now");
    branchId = offer.shop.branchId;
  }

  const rows = await cartRows(prisma, userId);
  const cartBranch = rows.find((row) => row.branchId)?.branchId;
  if (cartBranch && cartBranch !== branchId) {
    if (!input.replaceCart) {
      const [current, next] = await Promise.all([
        prisma.branch.findUnique({ where: { id: cartBranch }, select: offerBranchSelect }),
        prisma.branch.findUnique({ where: { id: branchId }, select: offerBranchSelect }),
      ]);
      throw new AppError("CART_SHOP_CONFLICT", "Your cart has items from another shop", {
        cartShop: current ? describeShop(current, null) : null,
        newShop: next ? describeShop(next, null) : null,
      });
    }
    await prisma.cartItem.deleteMany({ where: { userId } });
  }

  const existing = await prisma.cartItem.findUnique({
    where: { userId_variantId: { userId, variantId: input.variantId } },
    select: { quantity: true, branchId: true },
  });
  const sameShop = existing?.branchId === branchId;
  const nextQuantity = Math.min((sameShop ? (existing?.quantity ?? 0) : 0) + input.quantity, MAX_QTY_PER_LINE);
  await assertListingStock(branchId, input.variantId, nextQuantity);
  await prisma.cartItem.upsert({
    where: { userId_variantId: { userId, variantId: input.variantId } },
    update: { quantity: nextQuantity, branchId },
    create: { userId, variantId: input.variantId, quantity: nextQuantity, branchId },
  });
  return getCartCount(userId);
}

export async function updateItem(userId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, userId }, select: { variantId: true, branchId: true } });
  if (!item) throw AppError.notFound("Cart item");
  if (item.branchId) await assertListingStock(item.branchId, item.variantId, quantity);
  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
}

export async function removeItem(userId: string, itemId: string) {
  await prisma.cartItem.deleteMany({ where: { id: itemId, userId } });
}

export async function clearCart(userId: string) {
  await prisma.cartItem.deleteMany({ where: { userId } });
}

/** "Save for later": moves the line's product to the wishlist and removes it from the cart. */
export async function moveToWishlist(userId: string, itemId: string) {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, userId },
    select: { id: true, variant: { select: { productId: true } } },
  });
  if (!item) throw AppError.notFound("Cart item");
  await prisma.$transaction([
    prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId: item.variant.productId } },
      update: {},
      create: { userId, productId: item.variant.productId },
    }),
    prisma.cartItem.delete({ where: { id: item.id } }),
  ]);
}

/**
 * Other shops that could fill this cart, for "switch shop" when the cart's shop is closed,
 * too far or missing items. Shops that have every item, are open and are nearest come first.
 */
export async function cartShopOptions(userId: string, browsing: Point | null) {
  const point = await customerPoint(prisma, userId, browsing);
  const rows = await cartRows(prisma, userId);
  if (rows.length === 0) return [];
  const listings = await prisma.branchVariantStock.findMany({
    where: { ...visibleListingWhere, variantId: { in: rows.map((row) => row.variantId) } },
    select: { variantId: true, price: true, stock: true, branch: { select: offerBranchSelect } },
  });
  const quantityOf = new Map(rows.map((row) => [row.variantId, row.quantity]));
  const byBranch = new Map<string, { shop: ReturnType<typeof describeShop>; available: number; itemsTotal: number }>();
  for (const listing of listings) {
    const entry = byBranch.get(listing.branch.id) ?? { shop: describeShop(listing.branch, point), available: 0, itemsTotal: 0 };
    const quantity = quantityOf.get(listing.variantId) ?? 0;
    if (listing.stock >= quantity) {
      entry.available += 1;
      entry.itemsTotal += listing.price * quantity;
    }
    byBranch.set(listing.branch.id, entry);
  }
  const current = rows.find((row) => row.branchId)?.branchId;
  return [...byBranch.values()]
    .map((entry) => ({ ...entry.shop, availableItems: entry.available, totalItems: rows.length, itemsTotal: entry.itemsTotal, isCurrent: entry.shop.branchId === current }))
    .sort(
      (a, b) =>
        b.availableItems - a.availableItems ||
        Number(b.isOpen && b.deliverable) - Number(a.isOpen && a.deliverable) ||
        (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
    );
}

/** Moves the whole cart to another shop; lines it doesn't sell stay and show as unavailable. */
export async function switchCartShop(userId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true, vendor: { status: "APPROVED" } }, select: { id: true } });
  if (!branch) throw AppError.notFound("Shop");
  await prisma.cartItem.updateMany({ where: { userId }, data: { branchId } });
}
