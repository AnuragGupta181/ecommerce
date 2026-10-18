import type { MessageAuthor, Prisma, TicketStatus } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { nextNumber } from "../../lib/numbering.js";
import { pageMeta, toSkipTake, type PaginationQuery } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import { createInAppNotification, inBackground, sendNotice } from "../../services/notify/index.js";
import { getSettings } from "../settings/settings.service.js";
import { loadLedger } from "../subscriptions/ledger.js";
import { fromDbDate } from "../subscriptions/subscription-dates.js";
import { levelFor, vendorCanSee } from "./ticket-routing.js";
import type { CreateTicketInput, TicketListQuery } from "./tickets.schema.js";

/** Whose view of the ticket: the customer who raised it, the shop, or the platform. */
export type TicketSide = { kind: "CUSTOMER"; userId: string } | { kind: "VENDOR"; vendorId: string; userId: string } | { kind: "ADMIN"; userId: string };

function scopeWhere(side: TicketSide): Prisma.TicketWhereInput {
  if (side.kind === "CUSTOMER") return { userId: side.userId };
  if (side.kind === "VENDOR") return { level: "MINOR", vendorId: side.vendorId };
  return {};
}

export async function createTicket(userId: string, input: CreateTicketInput) {
  let vendorId: string | null = null;
  if (input.orderId) {
    const order = await prisma.order.findFirst({ where: { id: input.orderId, userId }, select: { vendorId: true } });
    if (!order) throw AppError.badRequest("That order is not on your account");
    vendorId = order.vendorId;
  }
  if (input.subscriptionId) {
    const subscription = await prisma.subscription.findFirst({ where: { id: input.subscriptionId, userId }, select: { vendorId: true } });
    if (!subscription) throw AppError.badRequest("That subscription is not on your account");
    vendorId = subscription.vendorId;
  }
  const level = levelFor(input.category);
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        number: await nextNumber(tx, "TKT"),
        userId,
        category: input.category,
        level,
        subject: input.subject,
        orderId: input.orderId,
        subscriptionId: input.subscriptionId,
        vendorId,
        messages: { create: { authorId: userId, authorRole: "CUSTOMER", body: input.message } },
      },
    });
    return created;
  });
  inBackground(() => notifyNewTicket(ticket.id));
  return getTicket({ kind: "CUSTOMER", userId }, ticket.id);
}

async function notifyNewTicket(ticketId: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { user: { select: { name: true } }, vendor: { select: { email: true, shopName: true } } } });
  const firstMessage = await prisma.ticketMessage.findFirst({ where: { ticketId }, orderBy: { createdAt: "asc" }, select: { body: true } });
  const settings = await getSettings();
  const lines = [`From ${ticket.user.name}: ${firstMessage?.body ?? ""}`];
  const tasks: Promise<unknown>[] = [];
  if (ticket.level === "MINOR" && ticket.vendor) {
    tasks.push(sendNotice({ recipientType: "VENDOR", to: ticket.vendor.email, template: "ticket_new_vendor", subject: `Ticket ${ticket.number}: ${ticket.subject}`, heading: `A customer needs help (${ticket.number})`, lines: [...lines, `Reply: ${env.PORTAL_URL}/vendor/tickets/${ticket.id}`] }));
  } else {
    tasks.push(sendNotice({ recipientType: "ADMIN", to: settings.adminEmail, template: "ticket_new_admin", subject: `[${ticket.category}] ${ticket.number}: ${ticket.subject}`, heading: `New ${ticket.level.toLowerCase()} ticket ${ticket.number}`, lines: [...lines, `Open: ${env.PORTAL_URL}/tickets/${ticket.id}`] }));
  }
  await Promise.all(tasks);
}

export async function listTickets(side: TicketSide, query: TicketListQuery) {
  const where: Prisma.TicketWhereInput = {
    AND: [
      scopeWhere(side),
      {
        status: query.status,
        category: query.category,
        ...(side.kind === "ADMIN" ? { level: query.level, vendorId: query.vendorId } : {}),
        ...(query.q ? { OR: [{ number: { contains: query.q, mode: "insensitive" } }, { subject: { contains: query.q, mode: "insensitive" } }, { user: { name: { contains: query.q, mode: "insensitive" } } }] } : {}),
      },
    ],
  };
  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }],
      ...toSkipTake(query),
      include: { user: { select: { name: true } }, vendor: { select: { id: true, shopName: true } }, order: { select: { orderNumber: true } }, _count: { select: { messages: true } } },
    }),
    prisma.ticket.count({ where }),
  ]);
  return {
    items: rows.map(({ _count, ...row }) => ({ ...row, messageCount: _count.messages, vendor: side.kind === "CUSTOMER" || side.kind === "ADMIN" ? row.vendor : undefined })),
    meta: pageMeta(query, total),
  };
}

async function ticketFor(side: TicketSide, id: string) {
  const ticket = await prisma.ticket.findFirst({ where: { id, ...scopeWhere(side) } });
  if (!ticket) throw AppError.notFound("Ticket");
  return ticket;
}

/** Everything support needs to judge the complaint: who, what they ordered, and what happened. */
async function supportContext(ticket: { userId: string; orderId: string | null; subscriptionId: string | null }, side: TicketSide) {
  const vendorFilter = side.kind === "VENDOR" ? { vendorId: side.vendorId } : {};
  const [customer, orderStats, recentOrders, order, subscription] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ticket.userId }, select: { id: true, name: true, email: true, phone: true, createdAt: true, isBlocked: true } }),
    prisma.order.aggregate({ where: { userId: ticket.userId, status: "DELIVERED", ...vendorFilter }, _count: true, _sum: { payable: true } }),
    prisma.order.findMany({ where: { userId: ticket.userId, ...vendorFilter }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, orderNumber: true, status: true, payable: true, createdAt: true } }),
    ticket.orderId
      ? prisma.order.findUnique({
          where: { id: ticket.orderId },
          include: {
            items: { select: { productName: true, variantLabel: true, quantity: true, price: true, lineTotal: true, imageUrl: true } },
            history: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true, actorRole: true } },
            rider: { select: { name: true, phone: true } },
            vendor: { select: { shopName: true } },
          },
        })
      : null,
    ticket.subscriptionId
      ? prisma.subscription.findUnique({
          where: { id: ticket.subscriptionId },
          include: { plan: { select: { name: true } }, deliveries: { orderBy: { date: "desc" }, take: 14, select: { date: true, status: true, note: true } } },
        })
      : null,
  ]);
  return {
    customer: { ...customer, deliveredOrders: orderStats._count, totalSpent: orderStats._sum.payable ?? 0 },
    recentOrders,
    order: order
      ? {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          payable: order.payable,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt,
          deliveredAt: order.deliveredAt,
          shop: order.vendor?.shopName ?? null,
          items: order.items,
          history: order.history,
          rider: order.rider,
          shippingAddress: order.shippingAddress,
        }
      : null,
    subscription: subscription
      ? {
          id: subscription.id,
          number: subscription.number,
          plan: subscription.plan.name,
          status: subscription.status,
          startDate: fromDbDate(subscription.startDate),
          endDate: fromDbDate(subscription.endDate),
          recentDeliveries: subscription.deliveries.map((row) => ({ ...row, date: fromDbDate(row.date) })),
          ledger: await loadLedger(prisma, subscription.id),
        }
      : null,
  };
}

export async function getTicket(side: TicketSide, id: string) {
  const ticket = await ticketFor(side, id);
  const [messages, vendor] = await Promise.all([
    prisma.ticketMessage.findMany({ where: { ticketId: id }, orderBy: { createdAt: "asc" } }),
    ticket.vendorId ? prisma.vendor.findUnique({ where: { id: ticket.vendorId }, select: { id: true, shopName: true } }) : null,
  ]);
  return {
    ...ticket,
    vendor: side.kind === "VENDOR" ? undefined : vendor,
    messages: messages.map((message) => ({ ...message, mine: message.authorId === side.userId })),
    // Customers see their own thread; the shop and the admin also get the full context.
    context: side.kind === "CUSTOMER" ? undefined : await supportContext(ticket, side),
    handledBy: ticket.level === "MINOR" && ticket.vendorId ? "SHOP" : "PLATFORM",
  };
}

const authorOf: Record<TicketSide["kind"], MessageAuthor> = { CUSTOMER: "CUSTOMER", VENDOR: "VENDOR", ADMIN: "ADMIN" };

export async function reply(side: TicketSide, id: string, body: string) {
  const ticket = await ticketFor(side, id);
  if (ticket.status === "CLOSED") throw AppError.badRequest("This ticket is closed. Raise a new one if you still need help.");
  // A customer writing back on a resolved ticket reopens it; staff replies move it to in progress.
  const status: TicketStatus = side.kind === "CUSTOMER" ? (ticket.status === "RESOLVED" ? "OPEN" : ticket.status) : ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status;
  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId: id, authorId: side.userId, authorRole: authorOf[side.kind], body } }),
    prisma.ticket.update({ where: { id }, data: { status, lastMessageAt: new Date() } }),
  ]);
  inBackground(() => notifyReply(id, side.kind, body));
  return getTicket(side, id);
}

async function notifyReply(ticketId: string, from: TicketSide["kind"], body: string) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { user: { select: { id: true, name: true, email: true } }, vendor: { select: { email: true } } } });
  if (from !== "CUSTOMER") {
    await Promise.all([
      createInAppNotification(ticket.user.id, "SUPPORT", `Reply on ${ticket.number}`, body.slice(0, 140), { ticketId }),
      sendNotice({ recipientType: "CUSTOMER", to: ticket.user.email, template: "ticket_reply_customer", subject: `Re: ${ticket.subject} (${ticket.number})`, heading: `${from === "VENDOR" ? "The shop" : "Support"} replied`, lines: [body] }),
    ]);
    return;
  }
  const settings = await getSettings();
  const toVendor = vendorCanSee(ticket, ticket.vendorId ?? "");
  await sendNotice({
    recipientType: toVendor ? "VENDOR" : "ADMIN",
    to: toVendor ? ticket.vendor?.email : settings.adminEmail,
    template: "ticket_reply_staff",
    subject: `Re: ${ticket.subject} (${ticket.number})`,
    heading: `${ticket.user.name} replied`,
    lines: [body, `${env.PORTAL_URL}/${toVendor ? "vendor/" : ""}tickets/${ticket.id}`],
  });
}

export async function setStatus(side: TicketSide, id: string, status: TicketStatus, note?: string) {
  const ticket = await ticketFor(side, id);
  if (side.kind === "CUSTOMER" && status !== "CLOSED") throw AppError.forbidden("You can only close your own ticket");
  await prisma.$transaction([
    prisma.ticket.update({ where: { id }, data: { status, resolvedAt: status === "RESOLVED" ? new Date() : ticket.resolvedAt } }),
    prisma.ticketMessage.create({
      data: { ticketId: id, authorId: side.userId, authorRole: "SYSTEM", body: `Status changed to ${status.replace("_", " ").toLowerCase()}${note ? `: ${note}` : ""}` },
    }),
  ]);
  return getTicket(side, id);
}

/** Admin only: escalate a shop ticket to the platform, or hand a platform ticket to the shop. */
export async function setLevel(adminId: string, id: string, level: "MINOR" | "MAJOR") {
  const ticket = await ticketFor({ kind: "ADMIN", userId: adminId }, id);
  if (level === "MINOR" && !ticket.vendorId) throw AppError.badRequest("This ticket is not linked to a shop");
  await prisma.$transaction([
    prisma.ticket.update({ where: { id }, data: { level } }),
    prisma.ticketMessage.create({ data: { ticketId: id, authorId: adminId, authorRole: "SYSTEM", body: level === "MAJOR" ? "Escalated to platform support" : "Handed to the shop" } }),
  ]);
  return getTicket({ kind: "ADMIN", userId: adminId }, id);
}

export async function myTicketCounts(side: TicketSide, _query?: PaginationQuery) {
  const groups = await prisma.ticket.groupBy({ by: ["status"], where: scopeWhere(side), _count: true });
  return Object.fromEntries(groups.map((group) => [group.status, group._count]));
}
