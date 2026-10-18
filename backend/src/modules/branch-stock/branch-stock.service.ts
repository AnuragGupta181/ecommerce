import type { Prisma, StockMovementType } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake, type PaginationQuery } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { audit, type AuditActor } from "../audit/audit.service.js";
import type { ListingStockQuery, StockAdjustInput } from "./branch-stock.schema.js";

/**
 * The only place a listing's stock changes. Online orders, cancellations, returns,
 * subscription drops and counter bills all come through here, as do the vendor's
 * manual corrections, so every unit is accounted for in BranchStockMovement.
 */

export type ListingStockChange = {
  listingId: string;
  /** Signed: negative removes stock. */
  delta: number;
  type: StockMovementType;
  reason?: string;
  orderId?: string;
  subscriptionDeliveryId?: string;
  actorId?: string;
};

export type StockChangeResult = { listingId: string; stockAfter: number; lowStockThreshold: number; crossedLow: boolean };

export async function applyListingStockChange(db: Db, change: ListingStockChange): Promise<StockChangeResult | null> {
  if (change.delta === 0) return null;
  // Conditional decrement: concurrent orders can never take stock below zero.
  const guard = change.delta < 0 ? { stock: { gte: -change.delta } } : {};
  const { count } = await db.branchVariantStock.updateMany({
    where: { id: change.listingId, ...guard },
    data: { stock: { increment: change.delta } },
  });
  if (count === 0) {
    const exists = await db.branchVariantStock.count({ where: { id: change.listingId } });
    if (!exists) throw AppError.notFound("Listing");
    throw new AppError("OUT_OF_STOCK", "Not enough stock", { listingId: change.listingId });
  }
  const listing = await db.branchVariantStock.findUniqueOrThrow({
    where: { id: change.listingId },
    select: { stock: true, lowStockThreshold: true },
  });
  await db.branchStockMovement.create({
    data: {
      branchStockId: change.listingId,
      type: change.type,
      quantity: change.delta,
      stockAfter: listing.stock,
      reason: change.reason,
      orderId: change.orderId,
      subscriptionDeliveryId: change.subscriptionDeliveryId,
      createdById: change.actorId,
    },
  });
  const before = listing.stock - change.delta;
  return {
    listingId: change.listingId,
    stockAfter: listing.stock,
    lowStockThreshold: listing.lowStockThreshold,
    crossedLow: change.delta < 0 && before > listing.lowStockThreshold && listing.stock <= listing.lowStockThreshold,
  };
}

/** A vendor's own listing, or 404 (vendors never see each other's stock). */
export async function vendorListing(db: Db, vendorId: string, listingId: string) {
  const listing = await db.branchVariantStock.findFirst({ where: { id: listingId, branch: { vendorId } } });
  if (!listing) throw AppError.notFound("Listing");
  return listing;
}

/** Manual correction by the vendor (restock, damage, in-shop sale without a bill). */
export async function adjustListingStock(vendorId: string, listingId: string, input: StockAdjustInput, actor: AuditActor) {
  return prisma.$transaction(async (tx) => {
    const listing = await vendorListing(tx, vendorId, listingId);
    const delta = input.mode === "IN" ? input.quantity : input.mode === "OUT" ? -input.quantity : input.quantity - listing.stock;
    if (delta === 0) return { stock: listing.stock, crossedLow: false };
    if (input.mode === "SET") {
      // Optimistic: abort if an order changed stock between the read and this write.
      const { count } = await tx.branchVariantStock.updateMany({ where: { id: listingId, stock: listing.stock }, data: { stock: input.quantity } });
      if (count === 0) throw AppError.conflict("Stock changed while you were editing; refresh and try again");
      await tx.branchStockMovement.create({
        data: { branchStockId: listingId, type: "SET", quantity: delta, stockAfter: input.quantity, reason: input.reason, createdById: actor.id },
      });
    } else {
      await applyListingStockChange(tx, { listingId, delta, type: input.mode, reason: input.reason, actorId: actor.id });
    }
    await audit(tx, actor, { action: "stock.adjust", entity: "listing", entityId: listingId, vendorId, data: { mode: input.mode, quantity: input.quantity, delta, reason: input.reason } });
    const after = await tx.branchVariantStock.findUniqueOrThrow({ where: { id: listingId }, select: { stock: true } });
    return { stock: after.stock, crossedLow: false };
  });
}

const listingSelect = {
  id: true,
  price: true,
  mrp: true,
  costPrice: true,
  stock: true,
  lowStockThreshold: true,
  isAvailable: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, vendor: { select: { id: true, shopName: true } } } },
  variant: {
    select: {
      id: true,
      sku: true,
      label: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          createdByVendorId: true,
          category: { select: { name: true } },
          images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
        },
      },
    },
  },
} satisfies Prisma.BranchVariantStockSelect;

type ListingRow = Prisma.BranchVariantStockGetPayload<{ select: typeof listingSelect }>;

export function toListingRow(row: ListingRow, { includeCost }: { includeCost: boolean }) {
  return {
    id: row.id,
    price: row.price,
    mrp: row.mrp,
    costPrice: includeCost ? row.costPrice : undefined,
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
    isAvailable: row.isAvailable,
    status: row.stock === 0 ? "out" : row.stock <= row.lowStockThreshold ? "low" : "in",
    updatedAt: row.updatedAt,
    branch: { id: row.branch.id, name: row.branch.name },
    vendor: row.branch.vendor,
    variant: { id: row.variant.id, sku: row.variant.sku, label: row.variant.label },
    product: {
      id: row.variant.product.id,
      name: row.variant.product.name,
      slug: row.variant.product.slug,
      isActive: row.variant.product.isActive,
      category: row.variant.product.category.name,
      imageUrl: row.variant.product.images[0]?.url ?? null,
      ownedByVendor: row.variant.product.createdByVendorId !== null,
    },
  };
}

/** Listing table for a vendor (own stock, with cost) or the admin (read-only, any vendor). */
export async function listListings(scope: { vendorId?: string }, query: ListingStockQuery, { includeCost }: { includeCost: boolean }) {
  const and: Prisma.BranchVariantStockWhereInput[] = [];
  if (scope.vendorId) and.push({ branch: { vendorId: scope.vendorId } });
  if (query.vendorId) and.push({ branch: { vendorId: query.vendorId } });
  if (query.branchId) and.push({ branchId: query.branchId });
  if (query.q) {
    and.push({
      OR: [
        { variant: { sku: { contains: query.q, mode: "insensitive" } } },
        { variant: { label: { contains: query.q, mode: "insensitive" } } },
        { variant: { product: { name: { contains: query.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (query.status === "low") and.push({ stock: { gt: 0, lte: prisma.branchVariantStock.fields.lowStockThreshold } });
  if (query.status === "out") and.push({ stock: 0 });
  if (query.status === "in") and.push({ stock: { gt: prisma.branchVariantStock.fields.lowStockThreshold } });

  const where: Prisma.BranchVariantStockWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.branchVariantStock.findMany({
      where,
      orderBy: [{ stock: "asc" }, { variant: { product: { name: "asc" } } }],
      ...toSkipTake(query),
      select: listingSelect,
    }),
    prisma.branchVariantStock.count({ where }),
  ]);
  return { items: rows.map((row) => toListingRow(row, { includeCost })), meta: pageMeta(query, total) };
}

export async function listListingMovements(scope: { vendorId?: string }, listingId: string, query: PaginationQuery) {
  if (scope.vendorId) await vendorListing(prisma, scope.vendorId, listingId);
  const where = { branchStockId: listingId };
  const [items, total] = await Promise.all([
    prisma.branchStockMovement.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(query) }),
    prisma.branchStockMovement.count({ where }),
  ]);
  return { items, meta: pageMeta(query, total) };
}

export async function stockSummary(scope: { vendorId?: string; branchId?: string }) {
  const base: Prisma.BranchVariantStockWhereInput = {
    isAvailable: true,
    ...(scope.vendorId ? { branch: { vendorId: scope.vendorId } } : {}),
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
  const [low, out, units, valueRows] = await Promise.all([
    prisma.branchVariantStock.count({ where: { ...base, stock: { gt: 0, lte: prisma.branchVariantStock.fields.lowStockThreshold } } }),
    prisma.branchVariantStock.count({ where: { ...base, stock: 0 } }),
    prisma.branchVariantStock.aggregate({ where: base, _sum: { stock: true } }),
    prisma.branchVariantStock.findMany({ where: { ...base, stock: { gt: 0 } }, select: { stock: true, costPrice: true, price: true } }),
  ]);
  return {
    lowStock: low,
    outOfStock: out,
    totalUnits: units._sum.stock ?? 0,
    /** Stock valued at cost where the vendor set one, else at selling price. */
    stockValue: valueRows.reduce((sum, row) => sum + row.stock * (row.costPrice ?? row.price), 0),
  };
}

/**
 * Keeps the catalog's denormalised price fields (used for sorting and price filters) in step
 * with the cheapest listing of an approved, active shop.
 */
export async function syncProductPricing(db: Db, productId: string) {
  const listings = await db.branchVariantStock.findMany({
    where: { isAvailable: true, variant: { productId, isActive: true }, branch: { isActive: true, vendor: { status: "APPROVED" } } },
    select: { price: true, mrp: true },
  });
  if (listings.length === 0) return;
  const cheapest = listings.reduce((best, row) => (row.price < best.price ? row : best));
  const discountPercent = cheapest.mrp > cheapest.price ? Math.round(((cheapest.mrp - cheapest.price) / cheapest.mrp) * 100) : 0;
  await db.product.update({ where: { id: productId }, data: { minPrice: cheapest.price, minMrp: cheapest.mrp, discountPercent } });
}
