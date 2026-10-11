import type { DeliveryStatus, NotificationChannel, Prisma } from "../../generated/prisma/client.js";
import { pageMeta, toSkipTake, type PaginationQuery } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";

export async function listNotifications(userId: string, query: PaginationQuery) {
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(query) }),
    prisma.notification.count({ where }),
  ]);
  return { items, meta: pageMeta(query, total) };
}

export async function unreadCount(userId: string) {
  return { count: await prisma.notification.count({ where: { userId, readAt: null } }) };
}

export async function markRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

type LogQuery = PaginationQuery & { status?: DeliveryStatus; channel?: NotificationChannel; orderId?: string };

export async function listDeliveryLogs(query: LogQuery) {
  const where: Prisma.NotificationLogWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.channel ? { channel: query.channel } : {}),
    ...(query.orderId ? { orderId: query.orderId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
      include: { order: { select: { orderNumber: true } } },
    }),
    prisma.notificationLog.count({ where }),
  ]);
  return { items, meta: pageMeta(query, total) };
}
