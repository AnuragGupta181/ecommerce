import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { formatINR } from "../../lib/money.js";
import { nextNumber } from "../../lib/numbering.js";
import { pageMeta, paginationQuery, toSkipTake } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { inBackground, sendNotice } from "../../services/notify/index.js";
import { audit, type AuditActor } from "../audit/audit.service.js";
import { settle } from "./settlement.js";
import { dayRange } from "../../lib/day-range.js";

const fromBeforeTo = (value: { from: Date; to: Date }) => value.from <= value.to;

export const periodSchema = z.object(dayRange).refine(fromBeforeTo, "From must be before To");
export const createPayoutSchema = z
  .object({ vendorId: z.string().min(1), ...dayRange, note: z.string().trim().max(300).optional() })
  .refine(fromBeforeTo, "From must be before To");
export const markPaidSchema = z.object({ reference: z.string().trim().min(2).max(120), note: z.string().trim().max(300).optional() });
export const payoutListQuery = paginationQuery.extend({ vendorId: z.string().optional(), status: z.enum(["PENDING", "PAID"]).optional() });

type Period = { from: Date; to: Date };

/** Delivered, not yet settled orders and subscription drops in the period. */
async function unsettled(db: Db, vendorId: string, { from, to }: Period) {
  const [orders, drops, vendor] = await Promise.all([
    db.order.findMany({
      where: { vendorId, status: "DELIVERED", payoutId: null, deliveredAt: { gte: from, lte: to } },
      select: { id: true, orderNumber: true, deliveredAt: true, itemsTotal: true, deliveryFee: true, payable: true, commissionAmount: true, vendorEarning: true },
      orderBy: { deliveredAt: "asc" },
    }),
    db.subscriptionDelivery.findMany({
      where: { status: "DELIVERED", payoutId: null, deliveredAt: { gte: from, lte: to }, subscription: { vendorId } },
      select: { id: true, date: true, goodsAmount: true, deliveryFee: true, subscription: { select: { number: true } } },
      orderBy: { date: "asc" },
    }),
    db.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { commissionBps: true, shopName: true, email: true } }),
  ]);
  return { orders, drops, vendor, settlement: settle(orders, drops, vendor.commissionBps) };
}

/** Preview before creating a payout (admin) or "what's coming" (vendor). */
export async function previewSettlement(vendorId: string, period: Period) {
  const { orders, drops, settlement } = await unsettled(prisma, vendorId, period);
  return { ...settlement, orders, drops };
}

export async function createPayout(input: z.infer<typeof createPayoutSchema>, actor: AuditActor) {
  const payout = await prisma.$transaction(async (tx) => {
    const { orders, drops, settlement } = await unsettled(tx, input.vendorId, input);
    if (orders.length === 0 && drops.length === 0) throw AppError.badRequest("Nothing to settle in this period");
    const created = await tx.payout.create({
      data: {
        number: await nextNumber(tx, "PAY"),
        vendorId: input.vendorId,
        periodFrom: input.from,
        periodTo: input.to,
        orderCount: settlement.orderCount,
        deliveryCount: settlement.deliveryCount,
        grossAmount: settlement.grossAmount,
        commissionAmount: settlement.commissionAmount,
        netAmount: settlement.netAmount,
        note: input.note,
        createdById: actor.id,
      },
    });
    // Linking rows marks them settled, so the same sale can never be paid twice.
    const linkedOrders = await tx.order.updateMany({ where: { id: { in: orders.map((order) => order.id) }, payoutId: null }, data: { payoutId: created.id } });
    const linkedDrops = await tx.subscriptionDelivery.updateMany({ where: { id: { in: drops.map((drop) => drop.id) }, payoutId: null }, data: { payoutId: created.id } });
    if (linkedOrders.count !== orders.length || linkedDrops.count !== drops.length) throw AppError.conflict("Some of these sales were settled at the same time; refresh and try again");
    await audit(tx, actor, { action: "payout.create", entity: "payout", entityId: created.id, vendorId: input.vendorId, data: { net: settlement.netAmount } });
    return created;
  });
  return getPayout({}, payout.id);
}

export async function markPayoutPaid(id: string, input: z.infer<typeof markPaidSchema>, actor: AuditActor) {
  const payout = await prisma.payout.findUnique({ where: { id }, include: { vendor: { select: { email: true, shopName: true } } } });
  if (!payout) throw AppError.notFound("Payout");
  if (payout.status === "PAID") throw AppError.conflict("This payout is already marked paid");
  await prisma.$transaction(async (tx) => {
    await tx.payout.update({ where: { id }, data: { status: "PAID", paidAt: new Date(), reference: input.reference, note: input.note ?? payout.note } });
    await audit(tx, actor, { action: "payout.paid", entity: "payout", entityId: id, vendorId: payout.vendorId, data: { reference: input.reference } });
  });
  inBackground(() =>
    sendNotice({
      recipientType: "VENDOR",
      to: payout.vendor.email,
      template: "payout_paid",
      subject: `Settlement ${payout.number} completed`,
      heading: `Settlement ${payout.number} for ${payout.vendor.shopName}`,
      lines: [
        payout.netAmount >= 0 ? `We paid you ${formatINR(payout.netAmount)}.` : `Your payment of ${formatINR(-payout.netAmount)} to the platform is recorded.`,
        `Reference: ${input.reference}`,
        `Orders: ${payout.orderCount}, subscription drops: ${payout.deliveryCount}, commission: ${formatINR(payout.commissionAmount)}`,
      ],
    }),
  );
  return getPayout({}, id);
}

export async function listPayouts(scope: { vendorId?: string }, query: z.infer<typeof payoutListQuery>) {
  const where: Prisma.PayoutWhereInput = { vendorId: scope.vendorId ?? query.vendorId, status: query.status };
  const [items, total] = await Promise.all([
    prisma.payout.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(query), include: { vendor: { select: { id: true, shopName: true } } } }),
    prisma.payout.count({ where }),
  ]);
  return { items, meta: pageMeta(query, total) };
}

export async function getPayout(scope: { vendorId?: string }, id: string) {
  const payout = await prisma.payout.findFirst({
    where: { id, ...(scope.vendorId ? { vendorId: scope.vendorId } : {}) },
    include: {
      vendor: { select: { id: true, shopName: true, payoutUpi: true, payoutDetails: true } },
      orders: { select: { id: true, orderNumber: true, deliveredAt: true, itemsTotal: true, deliveryFee: true, payable: true, commissionAmount: true, vendorEarning: true }, orderBy: { deliveredAt: "asc" } },
      deliveries: { select: { id: true, date: true, goodsAmount: true, deliveryFee: true, subscription: { select: { number: true } } }, orderBy: { date: "asc" } },
    },
  });
  if (!payout) throw AppError.notFound("Payout");
  return payout;
}
