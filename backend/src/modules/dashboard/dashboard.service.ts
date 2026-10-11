import type { OrderStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { inventorySummary } from "../inventory/inventory.service.js";
import { ACTIVE_STATUSES } from "../orders/order-status.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Orders that count towards revenue. */
const REVENUE_STATUSES: OrderStatus[] = [...ACTIVE_STATUSES, "DELIVERED", "RETURN_REQUESTED", "RETURN_REJECTED"];

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function periodTotals(from: Date, to: Date) {
  const result = await prisma.order.aggregate({
    where: { createdAt: { gte: from, lt: to }, status: { in: REVENUE_STATUSES } },
    _sum: { payable: true },
    _count: true,
  });
  return { revenue: result._sum.payable ?? 0, orders: result._count };
}

export async function getDashboard(days: number) {
  const now = new Date();
  const today = startOfDay(now);
  const rangeStart = new Date(today.getTime() - (days - 1) * DAY_MS);
  const previousStart = new Date(rangeStart.getTime() - days * DAY_MS);

  const [current, previous, todayTotals, newCustomers, previousCustomers, pendingOrders, stock, rangeOrders, statusGroups, topItems, recentOrders] =
    await Promise.all([
      periodTotals(rangeStart, now),
      periodTotals(previousStart, rangeStart),
      periodTotals(today, now),
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: rangeStart } } }),
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: previousStart, lt: rangeStart } } }),
      prisma.order.count({ where: { status: { in: ["PLACED", "CONFIRMED", "PACKED"] } } }),
      inventorySummary(),
      prisma.order.findMany({
        where: { createdAt: { gte: rangeStart }, status: { in: REVENUE_STATUSES } },
        select: { createdAt: true, payable: true },
      }),
      prisma.order.groupBy({ by: ["status"], where: { createdAt: { gte: rangeStart } }, _count: true }),
      prisma.orderItem.groupBy({
        by: ["productId", "productName"],
        where: { order: { createdAt: { gte: rangeStart }, status: { in: REVENUE_STATUSES } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: "desc" } },
        take: 5,
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, orderNumber: true, status: true, payable: true, createdAt: true, user: { select: { name: true } } },
      }),
    ]);

  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < days; i += 1) {
    buckets.set(dayKey(new Date(rangeStart.getTime() + i * DAY_MS)), { revenue: 0, orders: 0 });
  }
  for (const order of rangeOrders) {
    const bucket = buckets.get(dayKey(order.createdAt));
    if (bucket) {
      bucket.revenue += order.payable;
      bucket.orders += 1;
    }
  }

  const aov = current.orders ? Math.round(current.revenue / current.orders) : 0;
  const previousAov = previous.orders ? Math.round(previous.revenue / previous.orders) : 0;

  return {
    rangeDays: days,
    kpis: {
      revenue: { value: current.revenue, change: percentChange(current.revenue, previous.revenue) },
      orders: { value: current.orders, change: percentChange(current.orders, previous.orders) },
      averageOrderValue: { value: aov, change: percentChange(aov, previousAov) },
      newCustomers: { value: newCustomers, change: percentChange(newCustomers, previousCustomers) },
      revenueToday: todayTotals.revenue,
      ordersToday: todayTotals.orders,
      pendingOrders,
      lowStock: stock.lowStock,
      outOfStock: stock.outOfStock,
    },
    series: [...buckets.entries()].map(([date, value]) => ({ date, ...value })),
    statusBreakdown: statusGroups.map((group) => ({ status: group.status, count: group._count })),
    topProducts: topItems.map((item) => ({
      productId: item.productId,
      name: item.productName,
      quantity: item._sum.quantity ?? 0,
      revenue: item._sum.lineTotal ?? 0,
    })),
    recentOrders: recentOrders.map(({ user, ...order }) => ({ ...order, customer: user.name })),
  };
}
