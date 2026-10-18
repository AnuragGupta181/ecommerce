import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { Point } from "../geo/geo.js";
import { productCardSelect, toProductCards } from "../products/products.presenter.js";

/** Returns which of `productIds` the user has wishlisted (empty for guests). */
export async function wishlistedIds(userId: string | undefined, productIds: string[]): Promise<Set<string>> {
  if (!userId || productIds.length === 0) return new Set();
  const rows = await prisma.wishlistItem.findMany({
    where: { userId, productId: { in: productIds } },
    select: { productId: true },
  });
  return new Set(rows.map((row) => row.productId));
}

export async function listWishlist(userId: string, point: Point | null = null) {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId, product: { isActive: true } },
    orderBy: { createdAt: "desc" },
    select: { product: { select: productCardSelect } },
  });
  const all = new Set(rows.map((row) => row.product.id));
  return toProductCards(rows.map((row) => row.product), all, point);
}

export async function wishlistProductIds(userId: string): Promise<string[]> {
  const rows = await prisma.wishlistItem.findMany({ where: { userId }, select: { productId: true } });
  return rows.map((row) => row.productId);
}

export async function addToWishlist(userId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });
  if (!product) throw AppError.notFound("Product");
  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
}

export async function removeFromWishlist(userId: string, productId: string) {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
}
