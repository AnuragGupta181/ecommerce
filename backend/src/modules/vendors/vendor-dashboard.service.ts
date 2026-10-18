import { prisma } from "../../lib/prisma.js";
import { stockSummary } from "../branch-stock/branch-stock.service.js";
import { unreadTotal } from "../chat/chat.service.js";
import { ACTIVE_STATUSES } from "../orders/order-status.js";
import { todayIST } from "../pricing/subscription.js";
import { toDbDate } from "../subscriptions/subscription-dates.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The vendor's home screen: what needs doing today and how the shop is doing. */
export async function vendorDashboard(vendorId: string, userId: string, days = 30) {
  const today = todayIST();
  const startOfToday = new Date(Date.parse(`${today}T00:00:00Z`) - 330 * 60_000);
  const since = new Date(startOfToday.getTime() - (days - 1) * DAY_MS);

  const [vendor, toAct, todayOrders, delivered, todayDrops, stock, unread, openTickets, subscribers, recentOrders, series] = await Promise.all([
    prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { shopName: true, status: true, rejectionReason: true, subscriptionsEnabled: true, commissionBps: true } }),
    prisma.order.groupBy({ by: ["status"], where: { vendorId, status: { in: [...ACTIVE_STATUSES] } }, _count: true }),
    prisma.order.count({ where: { vendorId, createdAt: { gte: startOfToday } } }),
    prisma.order.aggregate({ where: { vendorId, status: "DELIVERED", deliveredAt: { gte: since } }, _count: true, _sum: { itemsTotal: true, vendorEarning: true, commissionAmount: true } }),
    prisma.subscriptionDelivery.groupBy({ by: ["status"], where: { date: toDbDate(today), subscription: { vendorId } }, _count: true }),
    stockSummary({ vendorId }),
    unreadTotal({ kind: "VENDOR", vendorId, userId }),
    prisma.ticket.count({ where: { vendorId, level: "MINOR", status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.subscription.count({ where: { vendorId, status: "ACTIVE" } }),
    prisma.order.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, orderNumber: true, status: true, payable: true, createdAt: true, user: { select: { name: true } } } }),
    prisma.order.findMany({ where: { vendorId, status: "DELIVERED", deliveredAt: { gte: since } }, select: { deliveredAt: true, itemsTotal: true } }),
  ]);

  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < days; i += 1) buckets.set(new Date(since.getTime() + i * DAY_MS + 330 * 60_000).toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  for (const order of series) {
    const key = new Date(order.deliveredAt!.getTime() + 330 * 60_000).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += order.itemsTotal;
      bucket.orders += 1;
    }
  }
  const count = (groups: { status: string; _count: number }[], status: string) => groups.find((group) => group.status === status)?._count ?? 0;

  return {
    shop: vendor,
    today: {
      date: today,
      newOrders: todayOrders,
      toConfirm: count(toAct, "PLACED"),
      toPack: count(toAct, "CONFIRMED"),
      toDispatch: count(toAct, "PACKED") + count(toAct, "RIDER_ASSIGNED"),
      outForDelivery: count(toAct, "OUT_FOR_DELIVERY"),
      dropsScheduled: count(todayDrops, "SCHEDULED"),
      dropsDelivered: count(todayDrops, "DELIVERED"),
    },
    period: {
      days,
      ordersDelivered: delivered._count,
      sales: delivered._sum.itemsTotal ?? 0,
      earnings: delivered._sum.vendorEarning ?? 0,
      commission: delivered._sum.commissionAmount ?? 0,
    },
    stock,
    unreadMessages: unread.count,
    openTickets,
    activeSubscribers: subscribers,
    recentOrders: recentOrders.map(({ user, ...order }) => ({ ...order, customer: user.name })),
    series: [...buckets.entries()].map(([date, value]) => ({ date, ...value })),
  };
}
