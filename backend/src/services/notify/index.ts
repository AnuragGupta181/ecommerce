import type {
  NotificationChannel,
  NotificationType,
  OrderStatus,
  RecipientType,
} from "../../generated/prisma/enums.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { getSettings } from "../../modules/settings/settings.service.js";
import { sendEmail } from "./email.js";
import { templates, type NotifyOrder, type NotifyRider, type Rendered, type ShippingAddress } from "./templates.js";
import type { SendResult } from "./types.js";
import { sendWhatsApp } from "./whatsapp.js";

// ───────────────────────── background execution ─────────────────────────

const pending = new Set<Promise<unknown>>();

/**
 * Runs side effects (emails, WhatsApp) after the response path without blocking it.
 * Errors are logged, never thrown. Tests call `flushNotifications()` to await them.
 */
export function inBackground(task: () => Promise<unknown>): void {
  const promise = task()
    .catch((error: unknown) => logger.error({ err: error }, "Background notification task failed"))
    .finally(() => pending.delete(promise));
  pending.add(promise);
}

export async function flushNotifications(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending]);
}

// ───────────────────────── low-level delivery ─────────────────────────

type Delivery = {
  channel: NotificationChannel;
  recipientType: RecipientType;
  recipient: string | null | undefined;
  template: string;
  rendered: Rendered;
  orderId?: string;
  /** Keeps secrets such as OTPs out of the delivery log. */
  sensitive?: boolean;
};

async function deliver({ channel, recipientType, recipient, template, rendered, orderId, sensitive }: Delivery) {
  let result: SendResult;
  if (!recipient) {
    result = { status: "SKIPPED", reason: "No recipient address" };
  } else if (channel === "EMAIL") {
    result = await sendEmail({ to: recipient, ...rendered });
  } else {
    result = await sendWhatsApp(recipient, rendered.text);
  }

  await prisma.notificationLog.create({
    data: {
      channel,
      recipientType,
      recipient: recipient ?? "-",
      template,
      subject: channel === "EMAIL" ? rendered.subject : null,
      body: sensitive ? "[redacted]" : rendered.text,
      status: result.status,
      error: result.status === "FAILED" ? result.error : result.status === "SKIPPED" ? result.reason : null,
      providerRef: result.status === "SENT" ? result.providerRef : null,
      orderId,
    },
  });

  if (result.status === "FAILED") {
    logger.warn({ channel, template, orderId, error: result.error }, "Notification delivery failed");
  }
}

export type Notice = {
  recipientType: RecipientType;
  to: string | null | undefined;
  template: string;
  subject: string;
  heading: string;
  lines: (string | null | undefined)[];
  orderId?: string;
};

/** Emails a branded notice and records it in the delivery log; never throws. */
export async function sendNotice(notice: Notice) {
  try {
    const settings = await getSettings();
    await deliver({
      channel: "EMAIL",
      recipientType: notice.recipientType,
      recipient: notice.to,
      template: notice.template,
      rendered: templates.notice(settings.storeName, notice.subject, notice.heading, notice.lines),
      orderId: notice.orderId,
    });
  } catch (error) {
    logger.error({ err: error, template: notice.template }, "Notice failed");
  }
}

export async function createInAppNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  await prisma.notification.create({ data: { userId, type, title, body, data } });
}

// ───────────────────────── order loading ─────────────────────────

async function loadOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { select: { productName: true, variantLabel: true, quantity: true, lineTotal: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
      rider: true,
    },
  });
  if (!order) throw new Error(`Order ${orderId} not found for notification`);
  const notifyOrder: NotifyOrder = {
    orderNumber: order.orderNumber,
    payable: order.payable,
    paymentMethod: order.paymentMethod,
    shippingAddress: order.shippingAddress as ShippingAddress,
    items: order.items,
    user: order.user,
  };
  return { order, notifyOrder };
}

// ───────────────────────── business notifications ─────────────────────────

export async function notifyOrderPlaced(orderId: string) {
  const [{ order, notifyOrder }, settings] = await Promise.all([loadOrder(orderId), getSettings()]);
  const store = settings.storeName;
  const customer = templates.orderPlacedCustomer(store, notifyOrder);
  const admin = templates.orderPlacedAdmin(store, notifyOrder);

  await Promise.all([
    createInAppNotification(order.userId, "ORDER", "Order placed", `Your order ${order.orderNumber} has been placed.`, {
      orderId: order.id,
    }),
    deliver({ channel: "EMAIL", recipientType: "CUSTOMER", recipient: order.user.email, template: "order_placed", rendered: customer, orderId }),
    deliver({ channel: "EMAIL", recipientType: "ADMIN", recipient: settings.adminEmail, template: "order_placed_admin", rendered: admin, orderId }),
    deliver({ channel: "WHATSAPP", recipientType: "ADMIN", recipient: settings.adminWhatsapp, template: "order_placed_admin", rendered: admin, orderId }),
  ]);
}

/** Customer, rider and admin all receive the order ID with the rider's name and number. */
export async function notifyRiderAssigned(orderId: string) {
  const [{ order, notifyOrder }, settings] = await Promise.all([loadOrder(orderId), getSettings()]);
  if (!order.rider) throw new Error(`Order ${orderId} has no rider`);
  const rider: NotifyRider = order.rider;
  const store = settings.storeName;
  const customerMsg = templates.riderAssignedCustomer(store, notifyOrder, rider);
  const riderMsg = templates.riderAssignedRider(store, notifyOrder, rider);
  const adminMsg = templates.riderAssignedAdmin(store, notifyOrder, rider);
  const customerPhone = notifyOrder.shippingAddress.phone || order.user.phone;
  const template = "rider_assigned";

  await Promise.all([
    createInAppNotification(
      order.userId,
      "ORDER",
      "Delivery partner assigned",
      `${rider.name} (${rider.phone}) will deliver your order ${order.orderNumber}.`,
      { orderId: order.id },
    ),
    deliver({ channel: "EMAIL", recipientType: "CUSTOMER", recipient: order.user.email, template, rendered: customerMsg, orderId }),
    deliver({ channel: "WHATSAPP", recipientType: "CUSTOMER", recipient: customerPhone, template, rendered: customerMsg, orderId }),
    deliver({ channel: "EMAIL", recipientType: "RIDER", recipient: rider.email, template, rendered: riderMsg, orderId }),
    deliver({ channel: "WHATSAPP", recipientType: "RIDER", recipient: rider.whatsapp ?? rider.phone, template, rendered: riderMsg, orderId }),
    deliver({ channel: "EMAIL", recipientType: "ADMIN", recipient: settings.adminEmail, template, rendered: adminMsg, orderId }),
    deliver({ channel: "WHATSAPP", recipientType: "ADMIN", recipient: settings.adminWhatsapp, template, rendered: adminMsg, orderId }),
  ]);
}

const statusCopy: Partial<Record<OrderStatus, { title: string; email: boolean; message: (ctx: StatusContext) => string }>> = {
  CONFIRMED: { title: "Order confirmed", email: false, message: () => "We've confirmed your order and are preparing it." },
  PACKED: { title: "Order packed", email: false, message: () => "Your order is packed and will be handed to a delivery partner soon." },
  OUT_FOR_DELIVERY: {
    title: "Out for delivery",
    email: true,
    message: ({ riderName, riderPhone }) =>
      riderName ? `Your order is on its way with ${riderName} (${riderPhone}).` : "Your order is on its way.",
  },
  DELIVERED: {
    title: "Delivered",
    email: true,
    message: ({ coinsEarned }) =>
      coinsEarned > 0 ? `Your order was delivered. You earned ${coinsEarned} Haat Coins!` : "Your order was delivered.",
  },
  CANCELLED: {
    title: "Order cancelled",
    email: true,
    message: ({ reason }) => `Your order has been cancelled.${reason ? ` Reason: ${reason}` : ""}`,
  },
  RETURN_REQUESTED: { title: "Return requested", email: false, message: () => "We've received your return request." },
  RETURNED: { title: "Return completed", email: true, message: () => "Your return is complete." },
  RETURN_REJECTED: {
    title: "Return request declined",
    email: true,
    message: ({ reason }) => `Your return request was declined.${reason ? ` ${reason}` : ""}`,
  },
};

type StatusContext = { riderName?: string; riderPhone?: string; coinsEarned: number; reason?: string | null };

export async function notifyOrderStatus(orderId: string, status: OrderStatus, reason?: string | null) {
  const copy = statusCopy[status];
  if (!copy) return;
  const [{ order, notifyOrder }, settings] = await Promise.all([loadOrder(orderId), getSettings()]);
  const message = copy.message({
    riderName: order.rider?.name,
    riderPhone: order.rider?.phone,
    coinsEarned: order.coinsEarned,
    reason,
  });

  const tasks: Promise<unknown>[] = [
    createInAppNotification(order.userId, "ORDER", copy.title, `${order.orderNumber}: ${message}`, { orderId: order.id }),
  ];
  if (copy.email) {
    tasks.push(
      deliver({
        channel: "EMAIL",
        recipientType: "CUSTOMER",
        recipient: order.user.email,
        template: `order_${status.toLowerCase()}`,
        rendered: templates.orderStatusCustomer(settings.storeName, notifyOrder, copy.title, message),
        orderId,
      }),
    );
  }
  await Promise.all(tasks);
}

export async function sendPasswordResetOtp(user: { name: string; email: string }, otp: string) {
  const settings = await getSettings();
  await deliver({
    channel: "EMAIL",
    recipientType: "CUSTOMER",
    recipient: user.email,
    template: "password_reset",
    rendered: templates.passwordResetOtp(settings.storeName, user.name, otp),
    sensitive: true,
  });
}
