import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { nextNumber } from "../../lib/numbering.js";
import { pageMeta, paginationQuery, toSkipTake } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { inBackground } from "../../services/notify/index.js";
import { audit, type AuditActor } from "../audit/audit.service.js";
import { applyListingStockChange, type StockChangeResult } from "../branch-stock/branch-stock.service.js";
import { notifyLowStock } from "../orders/order-events.js";
import { optionalDayRange } from "../../lib/day-range.js";

export const counterSaleSchema = z.object({
  branchId: z.string().min(1),
  items: z
    .array(
      z.object({
        listingId: z.string().min(1),
        quantity: z.number().int().min(1).max(10_000),
        /** Override for a negotiated price at the counter; defaults to the listing price. */
        price: z.number().int().min(0).optional(),
      }),
    )
    .min(1)
    .max(100),
  customerName: z.string().trim().max(80).optional(),
  customerPhone: z.string().trim().max(20).optional(),
  method: z.enum(["CASH", "UPI", "OTHER"]).default("CASH"),
});

export const counterSaleListQuery = paginationQuery.extend({
  branchId: z.string().optional(),
  ...optionalDayRange,
});

export type CounterSaleInput = z.infer<typeof counterSaleSchema>;
export type CounterSaleListQuery = z.infer<typeof counterSaleListQuery>;

/** An in-shop bill. Stock leaves the same way an online order takes it. */
export async function createCounterSale(vendorId: string, input: CounterSaleInput, actor: AuditActor) {
  const branch = await prisma.branch.findFirst({ where: { id: input.branchId, vendorId }, select: { id: true } });
  if (!branch) throw AppError.notFound("Branch");
  const lowStock: StockChangeResult[] = [];

  const sale = await prisma.$transaction(async (tx) => {
    const listings = await tx.branchVariantStock.findMany({
      where: { id: { in: input.items.map((item) => item.listingId) }, branchId: input.branchId },
      select: { id: true, price: true, costPrice: true, variant: { select: { label: true, product: { select: { name: true } } } } },
    });
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    const lines = input.items.map((item) => {
      const listing = byId.get(item.listingId);
      if (!listing) throw AppError.badRequest("An item on this bill is not sold at this shop");
      const price = item.price ?? listing.price;
      return {
        listingId: listing.id,
        productName: listing.variant.product.name,
        variantLabel: listing.variant.label,
        price,
        costPrice: listing.costPrice,
        quantity: item.quantity,
        lineTotal: price * item.quantity,
      };
    });

    const created = await tx.counterSale.create({
      data: {
        number: await nextNumber(tx, "BILL"),
        vendorId,
        branchId: input.branchId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
        method: input.method,
        createdById: actor.id,
        items: { create: lines },
      },
      include: { items: true },
    });
    for (const line of lines) {
      const change = await applyListingStockChange(tx, {
        listingId: line.listingId,
        delta: -line.quantity,
        type: "COUNTER_SALE",
        reason: `Counter bill ${created.number}`,
        actorId: actor.id,
      });
      if (change?.crossedLow) lowStock.push(change);
    }
    await audit(tx, actor, { action: "counter_sale.create", entity: "counter_sale", entityId: created.id, vendorId, data: { total: created.total } });
    return created;
  });

  inBackground(() => notifyLowStock(vendorId, lowStock));
  return sale;
}

export async function listCounterSales(vendorId: string, query: CounterSaleListQuery) {
  const where: Prisma.CounterSaleWhereInput = {
    vendorId,
    branchId: query.branchId,
    createdAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
  };
  const [items, total, sum] = await Promise.all([
    prisma.counterSale.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(query), include: { _count: { select: { items: true } } } }),
    prisma.counterSale.count({ where }),
    prisma.counterSale.aggregate({ where, _sum: { total: true } }),
  ]);
  return { items: items.map(({ _count, ...sale }) => ({ ...sale, itemCount: _count.items })), meta: { ...pageMeta(query, total), totalAmount: sum._sum.total ?? 0 } };
}

export async function getCounterSale(vendorId: string, id: string) {
  const sale = await prisma.counterSale.findFirst({ where: { id, vendorId }, include: { items: true, vendor: { select: { shopName: true, address: true, phone: true, gstin: true } } } });
  if (!sale) throw AppError.notFound("Bill");
  return sale;
}
