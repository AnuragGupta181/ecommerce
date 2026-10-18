import type { Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { formatINR } from "../../lib/money.js";
import { nextNumber } from "../../lib/numbering.js";
import { pageMeta, toSkipTake, type PaginationQuery } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { inBackground, sendNotice } from "../../services/notify/index.js";
import { addressPoint } from "../geo/customer-point.js";
import { describeShop } from "../listings/offers.service.js";
import {
  addDays,
  buildSchedule,
  canChangeDelivery,
  instalmentPlan,
  quoteSubscription,
  todayIST,
  weekdayNames,
  type SubscriptionTerms,
} from "../pricing/subscription.js";
import { openConversation } from "../chat/chat.service.js";
import { loadLedger, recomputeInstalments } from "./ledger.js";
import { loadPlanForSubscribe, toPlanView } from "./plans.service.js";
import { fromDbDate, toDbDate } from "./subscription-dates.js";
import type { SubscribeInput, SubscriptionQuoteInput } from "./subscriptions.schema.js";

type Plan = Awaited<ReturnType<typeof loadPlanForSubscribe>>;

function termsFor(plan: Plan, period: SubscribeInput["period"], quantity: number): SubscriptionTerms {
  const price = plan.prices.find((row) => row.period === period);
  if (!price) throw AppError.badRequest(`This plan has no ${period.toLowerCase()} option`);
  return { quantity, pricePerDelivery: price.pricePerDelivery, deliveryFee: price.deliveryFee, deliveryFeeMode: price.deliveryFeeMode };
}

function assertStartDate(startDate: string) {
  const earliest = addDays(todayIST(), 1);
  if (startDate < earliest) throw AppError.badRequest(`The first delivery can be ${earliest} at the earliest`);
  if (startDate > addDays(todayIST(), 60)) throw AppError.badRequest("Start within the next 60 days");
}

/** Exact breakdown before subscribing: every date, goods, delivery, total and when to pay. */
export async function quote(userId: string | undefined, input: SubscriptionQuoteInput) {
  const plan = await loadPlanForSubscribe(input.planId);
  assertStartDate(input.startDate);
  const terms = termsFor(plan, input.period, input.quantity);
  const schedule = buildSchedule(input.startDate, input.period, input.weekdays, input.skipDates);
  const breakdown = quoteSubscription(schedule.dates.length, terms);
  let shop = describeShop(plan.branch, null);
  if (userId && input.addressId) {
    const address = await prisma.address.findFirst({ where: { id: input.addressId, userId }, select: { lat: true, lng: true } });
    if (address) shop = describeShop(plan.branch, addressPoint(address));
  }
  return {
    plan: toPlanView(plan, null),
    period: input.period,
    quantity: input.quantity,
    weekdays: weekdayNames(input.weekdays),
    schedule,
    terms,
    breakdown,
    instalments: instalmentPlan(breakdown.total, input.paymentPlan, schedule.startDate, schedule.endDate),
    shop,
  };
}

export async function subscribe(userId: string, input: SubscribeInput) {
  const plan = await loadPlanForSubscribe(input.planId);
  assertStartDate(input.startDate);
  if (plan.capacity !== null && plan._count.subscriptions >= plan.capacity) throw AppError.conflict("This plan is full right now");
  if (input.slot && plan.slots.length && !plan.slots.includes(input.slot)) throw AppError.badRequest("Pick one of the shop's delivery slots");

  const address = await prisma.address.findFirst({ where: { id: input.addressId, userId } });
  if (!address) throw AppError.badRequest("Select a delivery address");
  const point = addressPoint(address);
  const shop = describeShop(plan.branch, point);
  if (!shop.deliverable) throw new AppError("SHOP_UNAVAILABLE", `${shop.vendorName} does not deliver to this address`);

  const terms = termsFor(plan, input.period, input.quantity);
  const schedule = buildSchedule(input.startDate, input.period, input.weekdays, input.skipDates);
  if (schedule.dates.length === 0) throw AppError.badRequest("No delivery days in this period. Pick more days or skip fewer.");
  const unitsPerDrop = input.quantity * plan.quantityPerDelivery;
  const feePerDrop = terms.deliveryFeeMode === "PER_DELIVERY" ? terms.deliveryFee : 0;

  const created = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        number: await nextNumber(tx, "SUB"),
        userId,
        planId: plan.id,
        vendorId: plan.vendorId,
        branchId: plan.branchId,
        shippingAddress: {
          name: address.name,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          lat: point?.lat ?? null,
          lng: point?.lng ?? null,
        },
        period: input.period,
        startDate: toDbDate(schedule.startDate),
        endDate: toDbDate(schedule.endDate),
        weekdays: input.weekdays,
        slot: input.slot,
        quantity: input.quantity,
        pricePerDelivery: terms.pricePerDelivery,
        deliveryFee: terms.deliveryFee,
        deliveryFeeMode: terms.deliveryFeeMode,
        paymentPlan: input.paymentPlan,
      },
    });
    await tx.subscriptionDelivery.createMany({
      data: [
        ...schedule.dates.map((date) => ({ subscriptionId: subscription.id, date: toDbDate(date), quantity: unitsPerDrop, goodsAmount: terms.pricePerDelivery * input.quantity, deliveryFee: feePerDrop })),
        ...schedule.skipped.map((date) => ({ subscriptionId: subscription.id, date: toDbDate(date), status: "SKIPPED" as const, quantity: unitsPerDrop, goodsAmount: terms.pricePerDelivery * input.quantity, deliveryFee: feePerDrop, note: "Skipped" })),
      ],
    });
    await recomputeInstalments(tx, subscription.id);
    return subscription;
  });

  inBackground(() => onSubscribed(created.id));
  return getMySubscription(userId, created.id);
}

async function onSubscribed(subscriptionId: string) {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { plan: { select: { name: true } }, vendor: { select: { id: true, email: true, shopName: true } }, user: { select: { id: true, name: true, email: true } } },
  });
  const ledger = await loadLedger(prisma, subscriptionId);
  const conversation = await openConversation(prisma, subscription.userId, subscription.vendorId);
  const line = `New subscription ${subscription.number}: ${subscription.plan.name}, ${subscription.period.toLowerCase()} from ${fromDbDate(subscription.startDate)}.`;
  await Promise.all([
    prisma.$transaction([
      prisma.chatMessage.create({ data: { conversationId: conversation.id, senderRole: "SYSTEM", body: line } }),
      prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessage: line.slice(0, 120), lastMessageAt: new Date(), vendorUnread: { increment: 1 } } }),
    ]),
    sendNotice({
      recipientType: "VENDOR",
      to: subscription.vendor.email,
      template: "subscription_new_vendor",
      subject: `New subscriber: ${subscription.plan.name}`,
      heading: `${subscription.user.name} subscribed to ${subscription.plan.name}`,
      lines: [line, `Expected total ${formatINR(ledger.expectedTotal)}`, `Assign a delivery partner: ${env.PORTAL_URL}/vendor/subscriptions/${subscription.id}`],
    }),
    sendNotice({
      recipientType: "CUSTOMER",
      to: subscription.user.email,
      template: "subscription_new_customer",
      subject: `Subscription ${subscription.number} confirmed`,
      heading: `${subscription.plan.name} from ${subscription.vendor.shopName}`,
      lines: [
        `From ${fromDbDate(subscription.startDate)} to ${fromDbDate(subscription.endDate)}${subscription.slot ? `, ${subscription.slot}` : ""}.`,
        `Expected total: ${formatINR(ledger.expectedTotal)}`,
        ...ledger.instalments.map((row) => `Pay ${formatINR(row.amount)} by ${row.dueDate}`),
      ],
    }),
  ]);
}

// ───────────────────────── customer: manage ─────────────────────────

const listSelect = {
  id: true,
  number: true,
  status: true,
  period: true,
  startDate: true,
  endDate: true,
  weekdays: true,
  slot: true,
  quantity: true,
  plan: { select: { name: true, listing: { select: { variant: { select: { label: true, product: { select: { name: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } } } } } } } },
  vendor: { select: { id: true, shopName: true, slug: true } },
} satisfies Prisma.SubscriptionSelect;

export async function listMySubscriptions(userId: string, query: PaginationQuery) {
  const where = { userId };
  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({ where, orderBy: [{ status: "asc" }, { startDate: "desc" }], ...toSkipTake(query), select: listSelect }),
    prisma.subscription.count({ where }),
  ]);
  const today = todayIST();
  const next = await prisma.subscriptionDelivery.findMany({
    where: { subscriptionId: { in: rows.map((row) => row.id) }, status: "SCHEDULED", date: { gte: toDbDate(today) } },
    orderBy: { date: "asc" },
    distinct: ["subscriptionId"],
    select: { subscriptionId: true, date: true },
  });
  const nextOf = new Map(next.map((row) => [row.subscriptionId, fromDbDate(row.date)]));
  return {
    items: rows.map((row) => ({
      ...row,
      startDate: fromDbDate(row.startDate),
      endDate: fromDbDate(row.endDate),
      weekdays: weekdayNames(row.weekdays),
      product: { name: row.plan.listing.variant.product.name, variantLabel: row.plan.listing.variant.label, imageUrl: row.plan.listing.variant.product.images[0]?.url ?? null },
      nextDelivery: nextOf.get(row.id) ?? null,
    })),
    meta: pageMeta(query, total),
  };
}

export const subscriptionDetailInclude = {
  plan: { select: { id: true, name: true, slots: true, listing: { select: { variant: { select: { label: true, product: { select: { name: true, slug: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } } } } } } } },
  vendor: { select: { id: true, shopName: true, slug: true, phone: true, email: true } },
  branch: { select: { id: true, name: true } },
  rider: { select: { id: true, name: true, phone: true, whatsapp: true, vehicleType: true } },
  user: { select: { id: true, name: true, email: true, phone: true } },
  deliveries: { orderBy: { date: "asc" } },
  pauses: { orderBy: { fromDate: "asc" } },
  payments: { orderBy: { paidAt: "desc" } },
} satisfies Prisma.SubscriptionInclude;

export type SubscriptionDetailRow = Prisma.SubscriptionGetPayload<{ include: typeof subscriptionDetailInclude }>;

export async function presentSubscription(row: SubscriptionDetailRow) {
  const ledger = await loadLedger(prisma, row.id);
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    period: row.period,
    startDate: fromDbDate(row.startDate),
    endDate: fromDbDate(row.endDate),
    weekdays: weekdayNames(row.weekdays),
    weekdayMask: row.weekdays,
    slot: row.slot,
    quantity: row.quantity,
    pricePerDelivery: row.pricePerDelivery,
    deliveryFee: row.deliveryFee,
    deliveryFeeMode: row.deliveryFeeMode,
    paymentPlan: row.paymentPlan,
    shippingAddress: row.shippingAddress,
    cancelReason: row.cancelReason,
    plan: { id: row.plan.id, name: row.plan.name, slots: row.plan.slots },
    product: {
      name: row.plan.listing.variant.product.name,
      slug: row.plan.listing.variant.product.slug,
      variantLabel: row.plan.listing.variant.label,
      imageUrl: row.plan.listing.variant.product.images[0]?.url ?? null,
    },
    vendor: row.vendor,
    branch: row.branch,
    rider: row.rider,
    customer: row.user,
    deliveries: row.deliveries.map((delivery) => ({
      id: delivery.id,
      date: fromDbDate(delivery.date),
      status: delivery.status,
      quantity: delivery.quantity,
      amount: delivery.goodsAmount + delivery.deliveryFee,
      deliveredAt: delivery.deliveredAt,
      note: delivery.note,
      canChange: delivery.status !== "DELIVERED" && delivery.status !== "CANCELLED" && canChangeDelivery(fromDbDate(delivery.date)),
    })),
    pauses: row.pauses.map((pause) => ({ id: pause.id, fromDate: fromDbDate(pause.fromDate), toDate: fromDbDate(pause.toDate) })),
    payments: row.payments,
    ledger,
    actions: { canCancel: row.status === "ACTIVE", canRenew: row.status !== "CANCELLED" },
  };
}

async function mySubscriptionRow(userId: string, id: string) {
  const row = await prisma.subscription.findFirst({ where: { id, userId }, include: subscriptionDetailInclude });
  if (!row) throw AppError.notFound("Subscription");
  return row;
}

export async function getMySubscription(userId: string, id: string) {
  return presentSubscription(await mySubscriptionRow(userId, id));
}

function assertActive(status: string) {
  if (status !== "ACTIVE") throw AppError.badRequest("This subscription is no longer active");
}

/** Skip (or restore) one day, until 8 pm the evening before. */
export async function setSkip(userId: string, id: string, date: string, skip: boolean) {
  const row = await mySubscriptionRow(userId, id);
  assertActive(row.status);
  if (!canChangeDelivery(date)) throw AppError.badRequest("Changes for this day closed at 8 pm the evening before");
  const delivery = row.deliveries.find((entry) => fromDbDate(entry.date) === date);
  if (!delivery) throw AppError.badRequest("No delivery is planned on that day");
  if (delivery.status === "DELIVERED") throw AppError.badRequest("That delivery is already done");
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionDelivery.update({ where: { id: delivery.id }, data: skip ? { status: "SKIPPED", note: "Skipped" } : { status: "SCHEDULED", note: null } });
    await recomputeInstalments(tx, id);
  });
  return getMySubscription(userId, id);
}

/** "Pause while I'm away": every changeable drop in the range is skipped; the period is not extended. */
export async function pause(userId: string, id: string, fromDate: string, toDate: string) {
  const row = await mySubscriptionRow(userId, id);
  assertActive(row.status);
  const changeable = row.deliveries.filter((entry) => {
    const date = fromDbDate(entry.date);
    return date >= fromDate && date <= toDate && entry.status === "SCHEDULED" && canChangeDelivery(date);
  });
  if (changeable.length === 0) throw AppError.badRequest("No upcoming deliveries in those dates can still be changed");
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPause.create({ data: { subscriptionId: id, fromDate: toDbDate(fromDate), toDate: toDbDate(toDate) } });
    await tx.subscriptionDelivery.updateMany({ where: { id: { in: changeable.map((entry) => entry.id) } }, data: { status: "SKIPPED", note: "Paused" } });
    await recomputeInstalments(tx, id);
  });
  return getMySubscription(userId, id);
}

export async function removePause(userId: string, id: string, pauseId: string) {
  const row = await mySubscriptionRow(userId, id);
  assertActive(row.status);
  const pauseRow = row.pauses.find((entry) => entry.id === pauseId);
  if (!pauseRow) throw AppError.notFound("Pause");
  const restorable = row.deliveries.filter(
    (entry) => entry.status === "SKIPPED" && entry.note === "Paused" && entry.date >= pauseRow.fromDate && entry.date <= pauseRow.toDate && canChangeDelivery(fromDbDate(entry.date)),
  );
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPause.delete({ where: { id: pauseId } });
    if (restorable.length) await tx.subscriptionDelivery.updateMany({ where: { id: { in: restorable.map((entry) => entry.id) } }, data: { status: "SCHEDULED", note: null } });
    await recomputeInstalments(tx, id);
  });
  return getMySubscription(userId, id);
}

/** Future drops are cancelled; delivered ones stay charged. Any prepaid credit shows as a negative balance. */
export async function cancel(userId: string, id: string, reason: string) {
  const row = await mySubscriptionRow(userId, id);
  assertActive(row.status);
  const future = row.deliveries.filter((entry) => (entry.status === "SCHEDULED" || entry.status === "SKIPPED") && canChangeDelivery(fromDbDate(entry.date)));
  await prisma.$transaction(async (tx) => {
    if (future.length) await tx.subscriptionDelivery.updateMany({ where: { id: { in: future.map((entry) => entry.id) } }, data: { status: "CANCELLED" } });
    await tx.subscription.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
    await recomputeInstalments(tx, id);
  });
  inBackground(() =>
    sendNotice({
      recipientType: "VENDOR",
      to: row.vendor.email,
      template: "subscription_cancelled",
      subject: `Subscription ${row.number} cancelled`,
      heading: `${row.user.name} cancelled ${row.plan.name}`,
      lines: [`Reason: ${reason}`],
    }),
  );
  return getMySubscription(userId, id);
}

/** Same plan, days, slot and address, starting the day after the current period ends (or tomorrow). */
export async function renew(userId: string, id: string) {
  const row = await mySubscriptionRow(userId, id);
  const address = await prisma.address.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }], select: { id: true } });
  if (!address) throw AppError.badRequest("Add a delivery address first");
  const nextStart = [addDays(fromDbDate(row.endDate), 1), addDays(todayIST(), 1)].sort().at(-1)!;
  return subscribe(userId, {
    planId: row.plan.id,
    period: row.period,
    startDate: nextStart,
    weekdays: row.weekdays,
    quantity: row.quantity,
    slot: row.slot ?? undefined,
    skipDates: [],
    addressId: address.id,
    paymentPlan: row.paymentPlan,
  });
}
