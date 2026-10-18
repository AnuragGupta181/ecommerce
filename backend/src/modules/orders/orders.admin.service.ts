import type { OrderStatus, Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { whatsappLink } from "../../lib/phone.js";
import { prisma } from "../../lib/prisma.js";
import { inBackground, notifyRiderAssigned } from "../../services/notify/index.js";
import { templates, type ShippingAddress } from "../../services/notify/templates.js";
import { getSettings } from "../settings/settings.service.js";
import { ORDER_TRANSITIONS, RIDER_ASSIGNABLE } from "./order-status.js";
import { transitionOrder, type Actor } from "./order-transitions.js";
import type { AdminOrderListQuery } from "./orders.schema.js";

/** Vendor portal calls pass their vendor id; admin calls pass nothing and see every shop. */
export type OrderScope = { vendorId?: string };

export async function listOrdersAdmin(query: AdminOrderListQuery, scope: OrderScope = {}) {
  const and: Prisma.OrderWhereInput[] = [];
  if (scope.vendorId) and.push({ vendorId: scope.vendorId });
  if (query.vendorId) and.push({ vendorId: query.vendorId });
  if (query.branchId) and.push({ branchId: query.branchId });
  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { orderNumber: contains },
        { user: { name: contains } },
        { user: { email: contains } },
        { user: { phone: contains } },
      ],
    });
  }
  if (query.status) and.push({ status: query.status });
  if (query.riderId) and.push({ riderId: query.riderId });
  if (query.from) and.push({ createdAt: { gte: query.from } });
  if (query.to) and.push({ createdAt: { lte: query.to } });

  const where: Prisma.OrderWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        payable: true,
        createdAt: true,
        user: { select: { id: true, name: true, phone: true } },
        rider: { select: { id: true, name: true } },
        vendor: { select: { id: true, shopName: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return {
    items: rows.map(({ _count, ...row }) => ({ ...row, itemCount: _count.items })),
    meta: pageMeta(query, total),
  };
}

export async function orderStatusCounts(scope: OrderScope = {}) {
  const groups = await prisma.order.groupBy({ by: ["status"], where: scope.vendorId ? { vendorId: scope.vendorId } : undefined, _count: true });
  return Object.fromEntries(groups.map((group) => [group.status, group._count])) as Partial<Record<OrderStatus, number>>;
}

export async function getOrderAdmin(id: string, scope: OrderScope = {}) {
  const [order, settings] = await Promise.all([
    prisma.order.findFirst({
      where: { id, ...(scope.vendorId ? { vendorId: scope.vendorId } : {}) },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        rider: true,
        vendor: { select: { id: true, shopName: true, phone: true, email: true } },
        branch: { select: { id: true, name: true, address: true, lat: true, lng: true } },
        items: true,
        history: { orderBy: { createdAt: "asc" } },
        notificationLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    }),
    getSettings(),
  ]);
  if (!order) throw AppError.notFound("Order");

  const address = order.shippingAddress as ShippingAddress;
  let whatsappLinks: { customer: string; rider: string; admin: string | null } | null = null;
  if (order.rider) {
    const notifyOrder = { ...order, shippingAddress: address };
    const store = settings.storeName;
    whatsappLinks = {
      customer: whatsappLink(address.phone, templates.riderAssignedCustomer(store, notifyOrder, order.rider).text),
      rider: whatsappLink(order.rider.whatsapp ?? order.rider.phone, templates.riderAssignedRider(store, notifyOrder, order.rider).text),
      admin: settings.adminWhatsapp
        ? whatsappLink(settings.adminWhatsapp, templates.riderAssignedAdmin(store, notifyOrder, order.rider).text)
        : null,
    };
  }

  return {
    ...order,
    shippingAddress: address,
    allowedTransitions: ORDER_TRANSITIONS[order.status].filter((status) => status !== "RIDER_ASSIGNED"),
    canAssignRider: RIDER_ASSIGNABLE.includes(order.status),
    whatsappLinks,
  };
}

/** 404 unless the order belongs to the scoped vendor. */
async function assertInScope(id: string, scope: OrderScope) {
  if (!scope.vendorId) return;
  const owned = await prisma.order.count({ where: { id, vendorId: scope.vendorId } });
  if (!owned) throw AppError.notFound("Order");
}

export async function updateOrderStatus(id: string, status: OrderStatus, note: string | undefined, actor: Actor, scope: OrderScope = {}) {
  await assertInScope(id, scope);
  return transitionOrder(id, status, { actor, note, reason: status === "CANCELLED" || status === "RETURN_REJECTED" ? note : undefined });
}

/** Assigns (or reassigns) a registered, active rider and notifies customer, rider and admin. */
export async function assignRider(orderId: string, riderId: string, note: string | undefined, actor: Actor, scope: OrderScope = {}) {
  await assertInScope(orderId, scope);
  await prisma.$transaction(async (tx) => {
    const [order, rider] = await Promise.all([
      tx.order.findUnique({ where: { id: orderId }, select: { status: true, riderId: true, vendorId: true } }),
      tx.rider.findUnique({ where: { id: riderId }, select: { name: true, phone: true, isActive: true, vendorId: true } }),
    ]);
    if (!order) throw AppError.notFound("Order");
    if (!rider) throw AppError.badRequest("Rider not found. Register the rider first.");
    // A shop's orders go out with that shop's own delivery partners.
    if (order.vendorId && rider.vendorId && rider.vendorId !== order.vendorId) throw AppError.badRequest("This delivery partner works for another shop");
    if (!rider.isActive) throw AppError.badRequest("This rider is inactive");
    if (!RIDER_ASSIGNABLE.includes(order.status)) {
      throw new AppError("INVALID_TRANSITION", `A rider cannot be assigned to a ${order.status} order`);
    }

    const advancesStatus = ["PLACED", "CONFIRMED", "PACKED"].includes(order.status);
    const nextStatus: OrderStatus = advancesStatus ? "RIDER_ASSIGNED" : order.status;
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { riderId, riderAssignedAt: new Date(), status: nextStatus },
    });
    if (count === 0) throw AppError.conflict("The order was updated by someone else; refresh and try again");

    const verb = order.riderId && order.riderId !== riderId ? "Reassigned" : "Assigned";
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: nextStatus,
        note: `${verb} to ${rider.name} (${rider.phone})${note ? `: ${note}` : ""}`,
        actorId: actor.id,
        actorRole: actor.role,
      },
    });
  });

  inBackground(() => notifyRiderAssigned(orderId));
  return getOrderAdmin(orderId, scope);
}

export async function resendRiderNotifications(orderId: string, scope: OrderScope = {}) {
  await assertInScope(orderId, scope);
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { riderId: true } });
  if (!order) throw AppError.notFound("Order");
  if (!order.riderId) throw AppError.badRequest("Assign a rider first");
  await notifyRiderAssigned(orderId);
  return getOrderAdmin(orderId, scope);
}

export function updateAdminNote(orderId: string, adminNote: string) {
  return prisma.order.update({ where: { id: orderId }, data: { adminNote }, select: { id: true, adminNote: true } });
}
