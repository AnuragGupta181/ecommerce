import type { Prisma, StockMovementType } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake, type PaginationQuery } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";
import type { AdjustStockInput, InventoryListQuery } from "./inventory.schema.js";

type StockChange = {
  variantId: string;
  /** Signed quantity: negative removes stock. */
  delta: number;
  type: StockMovementType;
  reason?: string;
  orderId?: string;
  actorId?: string;
};

/**
 * Applies a stock delta atomically and records the movement.
 * A conditional UPDATE guarantees stock never goes negative under concurrent orders.
 */
export async function applyStockChange(db: Db, change: StockChange) {
  if (change.delta === 0) return;
  const guard = change.delta < 0 ? { stock: { gte: -change.delta } } : {};
  const { count } = await db.productVariant.updateMany({
    where: { id: change.variantId, ...guard },
    data: { stock: { increment: change.delta } },
  });
  if (count === 0) {
    const exists = await db.productVariant.count({ where: { id: change.variantId } });
    if (!exists) throw AppError.notFound("Variant");
    throw new AppError("OUT_OF_STOCK", "Not enough stock", { variantId: change.variantId });
  }
  const { stock } = await db.productVariant.findUniqueOrThrow({ where: { id: change.variantId }, select: { stock: true } });
  await db.stockMovement.create({
    data: {
      variantId: change.variantId,
      type: change.type,
      quantity: change.delta,
      stockAfter: stock,
      reason: change.reason,
      orderId: change.orderId,
      createdById: change.actorId,
    },
  });
}

export async function adjustStock(variantId: string, input: AdjustStockInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } });
    if (!variant) throw AppError.notFound("Variant");

    const delta =
      input.mode === "IN" ? input.quantity : input.mode === "OUT" ? -input.quantity : input.quantity - variant.stock;
    if (delta === 0) return { stock: variant.stock };

    if (input.mode === "SET") {
      // Optimistic check: abort if an order changed stock between our read and write.
      const { count } = await tx.productVariant.updateMany({
        where: { id: variantId, stock: variant.stock },
        data: { stock: input.quantity },
      });
      if (count === 0) throw AppError.conflict("Stock changed while you were editing; refresh and try again");
      await tx.stockMovement.create({
        data: { variantId, type: "SET", quantity: delta, stockAfter: input.quantity, reason: input.reason, createdById: actorId },
      });
      return { stock: input.quantity };
    }

    await applyStockChange(tx, { variantId, delta, type: input.mode, reason: input.reason, actorId });
    return tx.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
  });
}

export async function listInventory(query: InventoryListQuery) {
  const and: Prisma.ProductVariantWhereInput[] = [];
  if (query.q) {
    and.push({
      OR: [
        { sku: { contains: query.q, mode: "insensitive" } },
        { label: { contains: query.q, mode: "insensitive" } },
        { product: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    });
  }
  if (query.categoryId) and.push({ product: { categoryId: query.categoryId } });
  if (query.status === "low") {
    and.push({ stock: { gt: 0, lte: prisma.productVariant.fields.lowStockThreshold } });
  }
  if (query.status === "out") and.push({ stock: 0 });
  if (query.status === "in") and.push({ stock: { gt: prisma.productVariant.fields.lowStockThreshold } });

  const where: Prisma.ProductVariantWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      orderBy: [{ stock: "asc" }, { product: { name: "asc" } }],
      ...toSkipTake(query),
      select: {
        id: true,
        sku: true,
        label: true,
        price: true,
        mrp: true,
        stock: true,
        lowStockThreshold: true,
        isActive: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            isActive: true,
            category: { select: { name: true } },
            images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
          },
        },
      },
    }),
    prisma.productVariant.count({ where }),
  ]);

  return {
    items: rows.map(({ product, ...variant }) => ({
      ...variant,
      status: variant.stock === 0 ? "out" : variant.stock <= variant.lowStockThreshold ? "low" : "in",
      product: { id: product.id, name: product.name, isActive: product.isActive, category: product.category.name },
      imageUrl: product.images[0]?.url ?? null,
    })),
    meta: pageMeta(query, total),
  };
}

export async function listMovements(variantId: string, query: PaginationQuery) {
  const where = { variantId };
  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(query) }),
    prisma.stockMovement.count({ where }),
  ]);
  return { items, meta: pageMeta(query, total) };
}

export async function updateThreshold(variantId: string, lowStockThreshold: number) {
  return prisma.productVariant.update({ where: { id: variantId }, data: { lowStockThreshold }, select: { id: true, lowStockThreshold: true } });
}

export async function inventorySummary() {
  const [low, out, totalUnits] = await Promise.all([
    prisma.productVariant.count({ where: { isActive: true, stock: { gt: 0, lte: prisma.productVariant.fields.lowStockThreshold } } }),
    prisma.productVariant.count({ where: { isActive: true, stock: 0 } }),
    prisma.productVariant.aggregate({ where: { isActive: true }, _sum: { stock: true } }),
  ]);
  return { lowStock: low, outOfStock: out, totalUnits: totalUnits._sum.stock ?? 0 };
}
