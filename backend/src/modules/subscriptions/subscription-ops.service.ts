import type { Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { randomToken } from "../../lib/crypto.js";
import { AppError } from "../../lib/errors.js";
import { formatINR } from "../../lib/money.js";
import { nextNumber } from "../../lib/numbering.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { whatsappLink } from "../../lib/phone.js";
import { prisma } from "../../lib/prisma.js";
import { inBackground, sendNotice } from "../../services/notify/index.js";
import { audit, type AuditActor } from "../audit/audit.service.js";
import { applyListingStockChange, type StockChangeResult } from "../branch-stock/branch-stock.service.js";
import { notifyLowStock } from "../orders/order-events.js";
import { todayIST } from "../pricing/subscription.js";
import { loadLedger } from "./ledger.js";
import { fromDbDate, toDbDate } from "./subscription-dates.js";
import { presentSubscription, subscriptionDetailInclude } from "./subscriptions.service.js";
import type { PaymentInput, VendorSubscriptionQuery } from "./subscriptions.schema.js";

export async function listVendorSubscriptions(vendorId: string, query: VendorSubscriptionQuery) {
  const where: Prisma.SubscriptionWhereInput = {
    vendorId,
    status: query.status,
    planId: query.planId,
    ...(query.q
      ? { OR: [{ number: { contains: query.q, mode: "insensitive" } }, { user: { name: { contains: query.q, mode: "insensitive" } } }, { user: { phone: { contains: query.q } } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      ...toSkipTake(query),
      include: { user: { select: { name: true, phone: true } }, plan: { select: { name: true } }, rider: { select: { id: true, name: true } } },
    }),
    prisma.subscription.count({ where }),
  ]);
  const ledgers = await Promise.all(rows.map((row) => loadLedger(prisma, row.id)));
  return {
    items: rows.map((row, index) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      period: row.period,
      startDate: fromDbDate(row.startDate),
      endDate: fromDbDate(row.endDate),
      slot: row.slot,
      quantity: row.quantity,
      customer: row.user,
      plan: row.plan,
      rider: row.rider,
      balance: ledgers[index]!.balance,
      dueNow: ledgers[index]!.dueNow,
    })),
    meta: pageMeta(query, total),
  };
}

async function vendorSubscriptionRow(vendorId: string, id: string) {
  const row = await prisma.subscription.findFirst({ where: { id, vendorId }, include: subscriptionDetailInclude });
  if (!row) throw AppError.notFound("Subscription");
  return row;
}

export async function getVendorSubscription(vendorId: string, id: string) {
  return presentSubscription(await vendorSubscriptionRow(vendorId, id));
}

// ───────────────────────── daily deliveries ─────────────────────────

const deliveryRowSelect = {
  id: true,
  date: true,
  status: true,
  quantity: true,
  goodsAmount: true,
  deliveryFee: true,
  deliveredAt: true,
  note: true,
  subscription: {
    select: {
      id: true,
      number: true,
      slot: true,
      shippingAddress: true,
      branchId: true,
      user: { select: { name: true, phone: true } },
      rider: { select: { id: true, name: true } },
      plan: { select: { name: true, listing: { select: { variant: { select: { label: true, product: { select: { name: true } } } } } } } },
    },
  },
} satisfies Prisma.SubscriptionDeliverySelect;

type DeliveryRow = Prisma.SubscriptionDeliveryGetPayload<{ select: typeof deliveryRowSelect }>;

function presentDelivery(row: DeliveryRow) {
  const address = row.subscription.shippingAddress as { name: string; phone: string; line1: string; line2?: string | null; city: string; lat?: number | null; lng?: number | null };
  return {
    id: row.id,
    date: fromDbDate(row.date),
    status: row.status,
    quantity: row.quantity,
    amount: row.goodsAmount + row.deliveryFee,
    deliveredAt: row.deliveredAt,
    note: row.note,
    slot: row.subscription.slot,
    subscription: { id: row.subscription.id, number: row.subscription.number },
    customer: { name: address.name || row.subscription.user.name, phone: address.phone || row.subscription.user.phone },
    address: [address.line1, address.line2, address.city].filter(Boolean).join(", "),
    mapUrl: typeof address.lat === "number" && typeof address.lng === "number" ? `https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}` : null,
    product: `${row.subscription.plan.listing.variant.product.name}${row.subscription.plan.listing.variant.label !== "Default" ? ` (${row.subscription.plan.listing.variant.label})` : ""}`,
    planName: row.subscription.plan.name,
    rider: row.subscription.rider,
  };
}

/** The "Today" page: every drop for the date, with totals per product for loading the van. */
export async function deliveriesForDate(vendorId: string, date = todayIST(), branchId?: string) {
  const rows = await prisma.subscriptionDelivery.findMany({
    where: { date: toDbDate(date), status: { in: ["SCHEDULED", "DELIVERED", "MISSED"] }, subscription: { vendorId, ...(branchId ? { branchId } : {}) } },
    orderBy: [{ subscription: { slot: "asc" } }, { subscription: { number: "asc" } }],
    select: deliveryRowSelect,
  });
  const deliveries = rows.map(presentDelivery);
  const totals = new Map<string, number>();
  for (const delivery of deliveries.filter((entry) => entry.status === "SCHEDULED")) totals.set(delivery.product, (totals.get(delivery.product) ?? 0) + delivery.quantity);
  return {
    date,
    deliveries,
    toLoad: [...totals.entries()].map(([product, quantity]) => ({ product, quantity })),
    counts: {
      scheduled: deliveries.filter((entry) => entry.status === "SCHEDULED").length,
      delivered: deliveries.filter((entry) => entry.status === "DELIVERED").length,
      missed: deliveries.filter((entry) => entry.status === "MISSED").length,
    },
  };
}

export type DeliveryActor = { id?: string; label: string };

/**
 * "Today's delivery sent": deducts the plan's stock and marks the drop delivered.
 * Each drop is its own transaction so one out-of-stock item doesn't block the rest.
 */
export async function markDelivered(scope: { vendorId?: string; riderId?: string }, ids: string[], actor: DeliveryActor) {
  const delivered: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  const lowStock: StockChangeResult[] = [];
  let vendorId: string | null = null;

  for (const id of ids) {
    try {
      await prisma.$transaction(async (tx) => {
        const row = await tx.subscriptionDelivery.findFirst({
          where: { id, subscription: { ...(scope.vendorId ? { vendorId: scope.vendorId } : {}), ...(scope.riderId ? { riderId: scope.riderId } : {}) } },
          select: { id: true, status: true, quantity: true, date: true, subscription: { select: { number: true, vendorId: true, plan: { select: { listingId: true } } } } },
        });
        if (!row) throw AppError.notFound("Delivery");
        if (row.status === "DELIVERED") return;
        if (row.status !== "SCHEDULED" && row.status !== "MISSED") throw AppError.badRequest(`This drop is ${row.status.toLowerCase()}`);
        if (fromDbDate(row.date) > todayIST()) throw AppError.badRequest("This drop is for a future day");
        const change = await applyListingStockChange(tx, {
          listingId: row.subscription.plan.listingId,
          delta: -row.quantity,
          type: "SUBSCRIPTION",
          reason: `Subscription ${row.subscription.number} · ${fromDbDate(row.date)} (${actor.label})`,
          subscriptionDeliveryId: row.id,
          actorId: actor.id,
        });
        if (change?.crossedLow) lowStock.push(change);
        await tx.subscriptionDelivery.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date(), markedById: actor.id, note: null } });
        vendorId = row.subscription.vendorId;
      });
      delivered.push(id);
    } catch (error) {
      failed.push({ id, reason: error instanceof Error ? error.message : "Could not mark delivered" });
    }
  }
  if (vendorId) {
    const target: string = vendorId;
    inBackground(() => notifyLowStock(target, lowStock));
  }
  return { delivered, failed };
}

export async function markMissed(vendorId: string, id: string, note: string, actor: AuditActor) {
  const row = await prisma.subscriptionDelivery.findFirst({ where: { id, subscription: { vendorId } }, select: { status: true } });
  if (!row) throw AppError.notFound("Delivery");
  if (row.status !== "SCHEDULED") throw AppError.badRequest("Only a scheduled drop can be marked missed");
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionDelivery.update({ where: { id }, data: { status: "MISSED", note, markedById: actor.id } });
    await audit(tx, actor, { action: "subscription.missed", entity: "subscription_delivery", entityId: id, vendorId, data: { note } });
  });
}

// ───────────────────────── payments ─────────────────────────

export async function recordPayment(vendorId: string, subscriptionId: string, input: PaymentInput, actor: AuditActor) {
  const row = await vendorSubscriptionRow(vendorId, subscriptionId);
  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.subscriptionPayment.create({
      data: { receiptNumber: await nextNumber(tx, "RCPT"), subscriptionId, amount: input.amount, method: input.method, note: input.note, recordedById: actor.id },
    });
    await audit(tx, actor, { action: input.amount > 0 ? "subscription.payment" : "subscription.refund", entity: "subscription", entityId: subscriptionId, vendorId, data: { amount: input.amount, receipt: created.receiptNumber } });
    return created;
  });
  inBackground(async () => {
    const ledger = await loadLedger(prisma, subscriptionId);
    await sendNotice({
      recipientType: "CUSTOMER",
      to: row.user.email,
      template: "subscription_payment",
      subject: `${input.amount > 0 ? "Payment received" : "Refund issued"}: ${payment.receiptNumber}`,
      heading: `${input.amount > 0 ? "Thanks for your payment" : "Your refund"}, ${row.user.name}`,
      lines: [
        `Receipt ${payment.receiptNumber} · ${formatINR(Math.abs(input.amount))} by ${input.method.toLowerCase()}`,
        `Subscription ${row.number} (${row.plan.name}) at ${row.vendor.shopName}`,
        ledger.balance > 0 ? `Balance due: ${formatINR(ledger.balance)}` : ledger.balance < 0 ? `In credit: ${formatINR(-ledger.balance)}` : "Fully paid so far.",
      ],
    });
  });
  return payment;
}

// ───────────────────────── delivery partner ─────────────────────────

export async function assignSubscriptionRider(vendorId: string, subscriptionId: string, riderId: string | null, actor: AuditActor) {
  await vendorSubscriptionRow(vendorId, subscriptionId);
  const rider = riderId ? await prisma.rider.findFirst({ where: { id: riderId, vendorId, isActive: true } }) : null;
  if (riderId && !rider) throw AppError.badRequest("Pick one of your active delivery partners");
  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({ where: { id: subscriptionId }, data: { riderId } });
    await audit(tx, actor, { action: "subscription.rider", entity: "subscription", entityId: subscriptionId, vendorId, data: { riderId } });
  });
  if (rider) inBackground(() => sendRiderScheduleLink(rider.id));
  return getVendorSubscription(vendorId, subscriptionId);
}

export function riderScheduleUrl(linkToken: string) {
  return `${env.PORTAL_URL}/r/${linkToken}`;
}

/** Sends the rider their private schedule link by email, plus a WhatsApp chat link for the vendor. */
export async function sendRiderScheduleLink(riderId: string) {
  const rider = await prisma.rider.findUniqueOrThrow({ where: { id: riderId }, include: { vendor: { select: { shopName: true } } } });
  let token = rider.linkToken;
  if (!token) {
    token = (await prisma.rider.update({ where: { id: riderId }, data: { linkToken: randomToken() } })).linkToken!;
  }
  const url = riderScheduleUrl(token);
  await sendNotice({
    recipientType: "RIDER",
    to: rider.email,
    template: "rider_schedule_link",
    subject: `Your delivery schedule for ${rider.vendor?.shopName ?? "your shop"}`,
    heading: `Hi ${rider.name}, here is your delivery plan`,
    lines: ["Open this link every morning to see today's drops and the whole month, with each customer's phone and map:", url, "Call the customer to confirm before you go. Keep the link private."],
  });
  return { url, whatsapp: whatsappLink(rider.whatsapp ?? rider.phone, `Your delivery schedule: ${url}`) };
}

async function riderByToken(token: string) {
  const rider = await prisma.rider.findFirst({ where: { linkToken: token, isActive: true }, include: { vendor: { select: { shopName: true, phone: true } } } });
  if (!rider) throw AppError.notFound("Schedule");
  return rider;
}

/** The rider's no-login page: today's subscription drops, open orders, and the month ahead. */
export async function riderSchedule(token: string, date = todayIST()) {
  const rider = await riderByToken(token);
  const monthEnd = toDbDate(fromDbDate(new Date(Date.parse(`${date}T00:00:00Z`) + 30 * 86_400_000)));
  const [today, upcoming, orders] = await Promise.all([
    prisma.subscriptionDelivery.findMany({
      where: { date: toDbDate(date), status: { in: ["SCHEDULED", "DELIVERED"] }, subscription: { riderId: rider.id } },
      orderBy: { subscription: { slot: "asc" } },
      select: deliveryRowSelect,
    }),
    prisma.subscriptionDelivery.groupBy({
      by: ["date"],
      where: { date: { gt: toDbDate(date), lte: monthEnd }, status: "SCHEDULED", subscription: { riderId: rider.id } },
      _count: true,
      _sum: { quantity: true },
      orderBy: { date: "asc" },
    }),
    prisma.order.findMany({
      where: { riderId: rider.id, status: { in: ["RIDER_ASSIGNED", "OUT_FOR_DELIVERY"] } },
      select: { id: true, orderNumber: true, status: true, payable: true, paymentMethod: true, shippingAddress: true, items: { select: { productName: true, quantity: true } } },
    }),
  ]);
  return {
    rider: { name: rider.name, shop: rider.vendor?.shopName ?? null, shopPhone: rider.vendor?.phone ?? null },
    date,
    today: today.map(presentDelivery),
    month: upcoming.map((day) => ({ date: fromDbDate(day.date), drops: day._count, units: day._sum.quantity ?? 0 })),
    orders: orders.map((order) => ({ ...order, collect: formatINR(order.payable) })),
  };
}

export async function riderMarkDelivered(token: string, deliveryId: string) {
  const rider = await riderByToken(token);
  return markDelivered({ riderId: rider.id }, [deliveryId], { label: `rider ${rider.name}` });
}
