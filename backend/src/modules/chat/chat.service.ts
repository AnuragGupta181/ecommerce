import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake, type PaginationQuery } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { createInAppNotification, inBackground, sendNotice } from "../../services/notify/index.js";

/** Who is reading or writing: the customer side or the vendor side of a conversation. */
export type ChatSide = { kind: "CUSTOMER"; userId: string } | { kind: "VENDOR"; vendorId: string; userId: string };

const PREVIEW_LENGTH = 120;

async function conversationFor(db: Db, side: ChatSide, conversationId: string) {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, ...(side.kind === "CUSTOMER" ? { userId: side.userId } : { vendorId: side.vendorId }) },
  });
  if (!conversation) throw AppError.notFound("Conversation");
  return conversation;
}

export async function openConversation(db: Db, userId: string, vendorId: string) {
  return db.conversation.upsert({
    where: { userId_vendorId: { userId, vendorId } },
    update: {},
    create: { userId, vendorId },
  });
}

/** Customer starts (or reopens) a chat with a shop. */
export async function startChat(userId: string, vendorId: string) {
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, status: "APPROVED" }, select: { id: true } });
  if (!vendor) throw AppError.notFound("Shop");
  return openConversation(prisma, userId, vendorId);
}

/** System line in the thread when the customer orders, so the vendor sees it in Messages. */
export async function postOrderMessage(userId: string, vendorId: string, orderId: string, body: string) {
  const conversation = await openConversation(prisma, userId, vendorId);
  await prisma.$transaction([
    prisma.chatMessage.create({ data: { conversationId: conversation.id, senderRole: "SYSTEM", body, orderId } }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), lastMessage: body.slice(0, PREVIEW_LENGTH), vendorUnread: { increment: 1 } },
    }),
  ]);
}

export async function listConversations(side: ChatSide, query: PaginationQuery) {
  const where = side.kind === "CUSTOMER" ? { userId: side.userId } : { vendorId: side.vendorId };
  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      ...toSkipTake(query),
      include: {
        vendor: { select: { id: true, shopName: true, slug: true, logoUrl: true } },
        user: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      lastMessage: row.lastMessage,
      lastMessageAt: row.lastMessageAt,
      unread: side.kind === "CUSTOMER" ? row.customerUnread : row.vendorUnread,
      vendor: row.vendor,
      customer: side.kind === "VENDOR" ? row.user : undefined,
    })),
    meta: pageMeta(query, total),
  };
}

/** Messages oldest-first. `after` (ISO time) returns only newer ones, for cheap polling. */
export async function listMessages(side: ChatSide, conversationId: string, after?: Date) {
  const conversation = await conversationFor(prisma, side, conversationId);
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: after ? 200 : 100,
  });
  const ordered = after ? messages : messages.reverse();
  const orderIds = [...new Set(ordered.map((message) => message.orderId).filter((id): id is string => id !== null))];
  const orders = orderIds.length
    ? await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true, status: true } })
    : [];
  const orderById = new Map(orders.map((order) => [order.id, order]));
  return {
    conversationId: conversation.id,
    messages: ordered.map((message) => ({
      id: message.id,
      body: message.body,
      senderRole: message.senderRole,
      mine: (side.kind === "CUSTOMER" && message.senderRole === "CUSTOMER") || (side.kind === "VENDOR" && message.senderRole === "VENDOR"),
      createdAt: message.createdAt,
      order: message.orderId ? (orderById.get(message.orderId) ?? null) : null,
    })),
  };
}

export async function sendMessage(side: ChatSide, conversationId: string, body: string, orderId?: string) {
  const conversation = await conversationFor(prisma, side, conversationId);
  if (orderId) {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId: conversation.userId, vendorId: conversation.vendorId }, select: { id: true } });
    if (!order) throw AppError.badRequest("That order is not between this customer and shop");
  }
  const toVendor = side.kind === "CUSTOMER";
  const [message, updated] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: { conversationId, senderId: side.userId, senderRole: side.kind, body, orderId },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessage: body.slice(0, PREVIEW_LENGTH),
        ...(toVendor ? { vendorUnread: { increment: 1 } } : { customerUnread: { increment: 1 } }),
      },
    }),
  ]);

  // Alert the other side only on the first unread message, not on every line of a conversation.
  const firstUnread = toVendor ? updated.vendorUnread === 1 : updated.customerUnread === 1;
  if (firstUnread) inBackground(() => alertRecipient(conversationId, toVendor, body));
  return message;
}

async function alertRecipient(conversationId: string, toVendor: boolean, body: string) {
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { vendor: { select: { shopName: true, email: true } }, user: { select: { id: true, name: true } } },
  });
  if (toVendor) {
    await sendNotice({
      recipientType: "VENDOR",
      to: conversation.vendor.email,
      template: "chat_message_vendor",
      subject: `New message from ${conversation.user.name}`,
      heading: `${conversation.user.name} sent you a message`,
      lines: [body, `Reply from your portal: ${env.PORTAL_URL}/vendor/messages/${conversation.id}`],
    });
  } else {
    await createInAppNotification(conversation.user.id, "CHAT", `Message from ${conversation.vendor.shopName}`, body.slice(0, PREVIEW_LENGTH), {
      conversationId: conversation.id,
    });
  }
}

export async function markRead(side: ChatSide, conversationId: string) {
  await conversationFor(prisma, side, conversationId);
  await prisma.conversation.update({
    where: { id: conversationId },
    data: side.kind === "CUSTOMER" ? { customerUnread: 0 } : { vendorUnread: 0 },
  });
}

export async function unreadTotal(side: ChatSide) {
  const result = await prisma.conversation.aggregate({
    where: side.kind === "CUSTOMER" ? { userId: side.userId } : { vendorId: side.vendorId },
    _sum: side.kind === "CUSTOMER" ? { customerUnread: true } : { vendorUnread: true },
  });
  const sum = result._sum as { customerUnread?: number | null; vendorUnread?: number | null };
  return { count: (side.kind === "CUSTOMER" ? sum.customerUnread : sum.vendorUnread) ?? 0 };
}
