import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { listCouponsForUser } from "../coupons/coupons.service.js";
import { buildQuote, loadLines, MAX_QTY_PER_LINE, type QuoteOptions } from "./quote.js";

async function cartLines(userId: string) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, variantId: true, quantity: true },
  });
  return loadLines(
    prisma,
    items.map((item) => ({ variantId: item.variantId, quantity: item.quantity, cartItemId: item.id })),
  );
}

export async function getCart(userId: string, options: QuoteOptions) {
  const lines = await cartLines(userId);
  const { summary } = await buildQuote(prisma, userId, lines, options);
  return { items: lines, summary };
}

export async function getCartCount(userId: string) {
  const result = await prisma.cartItem.aggregate({ where: { userId }, _sum: { quantity: true } });
  return { count: result._sum.quantity ?? 0 };
}

export async function getCartCoupons(userId: string) {
  const lines = await cartLines(userId);
  const itemsTotal = lines.filter((line) => line.available).reduce((sum, line) => sum + line.lineTotal, 0);
  return listCouponsForUser(userId, itemsTotal);
}

async function assertPurchasable(variantId: string, quantity: number) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { stock: true, isActive: true, product: { select: { isActive: true } } },
  });
  if (!variant || !variant.isActive || !variant.product.isActive) throw AppError.notFound("Product");
  if (variant.stock <= 0) throw new AppError("OUT_OF_STOCK", "This item is out of stock");
  if (quantity > variant.stock) throw new AppError("OUT_OF_STOCK", `Only ${variant.stock} left in stock`);
}

export async function addItem(userId: string, variantId: string, quantity: number) {
  const existing = await prisma.cartItem.findUnique({
    where: { userId_variantId: { userId, variantId } },
    select: { quantity: true },
  });
  const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, MAX_QTY_PER_LINE);
  await assertPurchasable(variantId, nextQuantity);
  await prisma.cartItem.upsert({
    where: { userId_variantId: { userId, variantId } },
    update: { quantity: nextQuantity },
    create: { userId, variantId, quantity: nextQuantity },
  });
  return getCartCount(userId);
}

export async function updateItem(userId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, userId }, select: { variantId: true } });
  if (!item) throw AppError.notFound("Cart item");
  await assertPurchasable(item.variantId, quantity);
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
