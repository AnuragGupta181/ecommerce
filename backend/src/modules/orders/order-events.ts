import { env } from "../../config/env.js";
import { formatINR } from "../../lib/money.js";
import { prisma } from "../../lib/prisma.js";
import { sendNotice } from "../../services/notify/index.js";
import type { StockChangeResult } from "../branch-stock/branch-stock.service.js";
import { postOrderMessage } from "../chat/chat.service.js";

/**
 * After-commit side effects of a new order for the vendor: the "new order" email,
 * a system message in the customer ↔ vendor chat, and low-stock alerts.
 */
export async function onOrderPlaced(orderId: string, lowStock: StockChangeResult[]) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      vendorId: true,
      payable: true,
      paymentMethod: true,
      shippingAddress: true,
      items: { select: { productName: true, variantLabel: true, quantity: true } },
      vendor: { select: { shopName: true, email: true } },
      user: { select: { name: true } },
    },
  });
  if (!order?.vendorId || !order.vendor) return;

  const address = order.shippingAddress as { name: string; phone: string; line1: string; city: string; lat?: number | null; lng?: number | null };
  const items = order.items.map((item) => `• ${item.productName}${item.variantLabel !== "Default" ? ` (${item.variantLabel})` : ""} × ${item.quantity}`).join("\n");

  await Promise.all([
    sendNotice({
      recipientType: "VENDOR",
      to: order.vendor.email,
      template: "order_placed_vendor",
      subject: `New order ${order.orderNumber}`,
      heading: `New order ${order.orderNumber} for ${order.vendor.shopName}`,
      lines: [
        `Customer: ${address.name} (${address.phone})`,
        items,
        `Amount: ${formatINR(order.payable)} (${order.paymentMethod === "COD" ? "Cash on Delivery" : "UPI on Delivery"})`,
        `Address: ${address.line1}, ${address.city}`,
        typeof address.lat === "number" && typeof address.lng === "number" ? `Map: https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}` : null,
        `Open it in your portal: ${env.PORTAL_URL}/vendor/orders/${order.id}`,
      ],
      orderId: order.id,
    }),
    postOrderMessage(order.userId, order.vendorId, order.id, `New order ${order.orderNumber} placed by ${order.user.name}.`),
    notifyLowStock(order.vendorId, lowStock),
  ]);
}

/** One email listing every listing that just crossed its low-stock threshold. */
export async function notifyLowStock(vendorId: string, changes: StockChangeResult[]) {
  if (changes.length === 0) return;
  const [vendor, listings] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { shopName: true, email: true } }),
    prisma.branchVariantStock.findMany({
      where: { id: { in: changes.map((change) => change.listingId) } },
      select: { stock: true, variant: { select: { label: true, product: { select: { name: true } } } }, branch: { select: { name: true } } },
    }),
  ]);
  if (!vendor) return;
  await sendNotice({
    recipientType: "VENDOR",
    to: vendor.email,
    template: "low_stock",
    subject: `Low stock at ${vendor.shopName}`,
    heading: "These items are running low",
    lines: [
      listings
        .map((row) => `• ${row.variant.product.name}${row.variant.label !== "Default" ? ` (${row.variant.label})` : ""} at ${row.branch.name}: ${row.stock} left`)
        .join("\n"),
      `Restock from your portal: ${env.PORTAL_URL}/vendor/stock?status=low`,
    ],
  });
}
