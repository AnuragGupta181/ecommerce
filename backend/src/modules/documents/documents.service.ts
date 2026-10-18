import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { getSettings } from "../settings/settings.service.js";
import { loadLedger } from "../subscriptions/ledger.js";
import { fromDbDate } from "../subscriptions/subscription-dates.js";
import { dateText, PdfWriter, rs } from "./pdf.js";

export type DocumentKind = "invoice" | "statement" | "receipt" | "payout" | "bill";
/** Who is asking: limits every document to the people it belongs to. */
export type DocumentScope = { userId?: string; vendorId?: string; admin?: boolean };

type Address = { name: string; phone: string; line1: string; line2?: string | null; landmark?: string | null; city: string; state: string; pincode: string };
const addressLines = (a: Address) => [a.name, a.phone, [a.line1, a.line2, a.landmark].filter(Boolean).join(", "), `${a.city}, ${a.state} ${a.pincode}`];

function scoped(scope: DocumentScope, ownerUserId: string | null, ownerVendorId: string | null) {
  if (scope.admin) return true;
  if (scope.userId && ownerUserId === scope.userId) return true;
  if (scope.vendorId && ownerVendorId === scope.vendorId) return true;
  return false;
}

export async function orderInvoice(orderId: string, scope: DocumentScope) {
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId }, include: { items: true, vendor: { select: { shopName: true, address: true, phone: true, gstin: true } }, user: { select: { name: true, email: true } } } }),
    getSettings(),
  ]);
  if (!order || !scoped(scope, order.userId, order.vendorId)) throw AppError.notFound("Invoice");
  const pdf = new PdfWriter().heading(`Invoice ${order.invoiceNumber ?? order.orderNumber}`, `${order.vendor?.shopName ?? settings.storeName} via ${settings.storeName}`, [
    ["Order", order.orderNumber],
    ["Date", dateText(order.createdAt)],
    ["Status", order.status.replace(/_/g, " ").toLowerCase()],
    ["Payment", `${order.paymentMethod === "COD" ? "Cash" : "UPI"} on delivery · ${order.paymentStatus.toLowerCase()}`],
  ]);
  pdf.block("Sold by", [order.vendor?.shopName, order.vendor?.address, order.vendor?.phone, order.vendor?.gstin ? `GSTIN ${order.vendor.gstin}` : null]);
  pdf.block("Deliver to", addressLines(order.shippingAddress as Address));
  pdf.table(
    [{ label: "Item", width: 250 }, { label: "Qty", width: 50, align: "right" }, { label: "MRP", width: 70, align: "right" }, { label: "Price", width: 70, align: "right" }, { label: "Total", width: 59, align: "right" }],
    order.items.map((item) => [`${item.productName}${item.variantLabel !== "Default" ? ` (${item.variantLabel})` : ""}`, String(item.quantity), rs(item.mrp), rs(item.price), rs(item.lineTotal)]),
  );
  pdf.totals([
    ["Items (MRP)", rs(order.itemsMrp)],
    ["Discount", `- ${rs(order.itemsMrp - order.itemsTotal)}`],
    ...(order.couponDiscount ? ([[`Coupon ${order.couponCode ?? ""}`, `- ${rs(order.couponDiscount)}`]] as [string, string][]) : []),
    ...(order.coinsUsed ? ([["Coins", `- ${rs(order.coinsUsed * 100)}`]] as [string, string][]) : []),
    [`Delivery${order.distanceKm ? ` (${order.distanceKm} km)` : ""}`, order.deliveryFee ? rs(order.deliveryFee) : "FREE"],
    ["Total", rs(order.payable), true],
  ]);
  pdf.note(`Thank you for shopping with ${order.vendor?.shopName ?? settings.storeName}. Questions? ${settings.supportEmail}`);
  return { filename: `${order.invoiceNumber ?? order.orderNumber}.pdf`, buffer: await pdf.toBuffer() };
}

export async function subscriptionStatement(subscriptionId: string, scope: DocumentScope) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: { select: { name: true } },
      vendor: { select: { shopName: true, address: true, phone: true } },
      user: { select: { name: true } },
      deliveries: { orderBy: { date: "asc" } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!subscription || !scoped(scope, subscription.userId, subscription.vendorId)) throw AppError.notFound("Statement");
  const ledger = await loadLedger(prisma, subscriptionId);
  const pdf = new PdfWriter().heading(`Statement ${subscription.number}`, `${subscription.plan.name} · ${subscription.vendor.shopName}`, [
    ["Customer", subscription.user.name],
    ["Period", `${fromDbDate(subscription.startDate)} to ${fromDbDate(subscription.endDate)}`],
    ["Plan", subscription.period.toLowerCase()],
    ["Status", subscription.status.toLowerCase()],
  ]);
  pdf.block("Deliver to", addressLines(subscription.shippingAddress as Address));
  pdf.table(
    [{ label: "Date", width: 100 }, { label: "Status", width: 110 }, { label: "Qty", width: 60, align: "right" }, { label: "Amount", width: 90, align: "right" }, { label: "Note", width: 139 }],
    subscription.deliveries.map((row) => [fromDbDate(row.date), row.status.toLowerCase(), String(row.quantity), row.status === "DELIVERED" ? rs(row.goodsAmount + row.deliveryFee) : "-", row.note ?? ""]),
  );
  if (subscription.payments.length) {
    pdf.table(
      [{ label: "Payment", width: 160 }, { label: "Date", width: 110 }, { label: "Method", width: 90 }, { label: "Amount", width: 139, align: "right" }],
      subscription.payments.map((payment) => [payment.receiptNumber, dateText(payment.paidAt), payment.method.toLowerCase(), rs(payment.amount)]),
    );
  }
  pdf.totals([
    ["Charged so far", rs(ledger.charged)],
    ["Paid", rs(ledger.paid)],
    [ledger.balance >= 0 ? "Balance due" : "In credit", rs(Math.abs(ledger.balance)), true],
    ["Expected for the period", rs(ledger.expectedTotal)],
  ]);
  return { filename: `${subscription.number}-statement.pdf`, buffer: await pdf.toBuffer() };
}

export async function paymentReceipt(paymentId: string, scope: DocumentScope) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { subscription: { select: { number: true, userId: true, vendorId: true, plan: { select: { name: true } }, vendor: { select: { shopName: true } }, user: { select: { name: true } } } } },
  });
  if (!payment || !scoped(scope, payment.subscription.userId, payment.subscription.vendorId)) throw AppError.notFound("Receipt");
  const pdf = new PdfWriter().heading(`${payment.amount >= 0 ? "Receipt" : "Refund"} ${payment.receiptNumber}`, payment.subscription.vendor.shopName, [
    ["Customer", payment.subscription.user.name],
    ["Date", dateText(payment.paidAt)],
    ["Subscription", `${payment.subscription.number} · ${payment.subscription.plan.name}`],
    ["Method", payment.method.toLowerCase()],
  ]);
  pdf.totals([["Amount", rs(Math.abs(payment.amount)), true]]);
  if (payment.note) pdf.note(payment.note);
  return { filename: `${payment.receiptNumber}.pdf`, buffer: await pdf.toBuffer() };
}

export async function payoutStatement(payoutId: string, scope: DocumentScope) {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: {
      vendor: { select: { shopName: true, payoutUpi: true } },
      orders: { select: { orderNumber: true, deliveredAt: true, itemsTotal: true, deliveryFee: true, payable: true, commissionAmount: true }, orderBy: { deliveredAt: "asc" } },
      deliveries: { select: { date: true, goodsAmount: true, deliveryFee: true, subscription: { select: { number: true } } }, orderBy: { date: "asc" } },
    },
  });
  if (!payout || !(scope.admin || scope.vendorId === payout.vendorId)) throw AppError.notFound("Payout");
  const pdf = new PdfWriter().heading(`Settlement ${payout.number}`, payout.vendor.shopName, [
    ["Period", `${dateText(payout.periodFrom)} to ${dateText(payout.periodTo)}`],
    ["Status", payout.status.toLowerCase()],
    ["Paid on", dateText(payout.paidAt)],
    ["Reference", payout.reference ?? "-"],
  ]);
  pdf.table(
    [{ label: "Order", width: 150 }, { label: "Delivered", width: 90 }, { label: "Sale", width: 90, align: "right" }, { label: "Collected", width: 90, align: "right" }, { label: "Commission", width: 79, align: "right" }],
    payout.orders.map((order) => [order.orderNumber, dateText(order.deliveredAt), rs(order.itemsTotal + order.deliveryFee), rs(order.payable), rs(order.commissionAmount)]),
  );
  if (payout.deliveries.length) {
    pdf.table(
      [{ label: "Subscription drop", width: 200 }, { label: "Date", width: 130 }, { label: "Amount", width: 169, align: "right" }],
      payout.deliveries.map((drop) => [drop.subscription.number, fromDbDate(drop.date), rs(drop.goodsAmount + drop.deliveryFee)]),
    );
  }
  pdf.totals([
    ["Gross sales", rs(payout.grossAmount)],
    ["Platform commission", rs(payout.commissionAmount)],
    [payout.netAmount >= 0 ? "Platform pays you" : "You pay the platform", rs(Math.abs(payout.netAmount)), true],
  ]);
  pdf.note("Customers paid your delivery partners directly, so the settlement is the platform-funded discounts minus commission.");
  return { filename: `${payout.number}.pdf`, buffer: await pdf.toBuffer() };
}

export async function counterBill(saleId: string, scope: DocumentScope) {
  const sale = await prisma.counterSale.findUnique({ where: { id: saleId }, include: { items: true, vendor: { select: { shopName: true, address: true, phone: true, gstin: true } } } });
  if (!sale || !(scope.admin || scope.vendorId === sale.vendorId)) throw AppError.notFound("Bill");
  const pdf = new PdfWriter().heading(`Bill ${sale.number}`, sale.vendor.shopName, [
    ["Date", dateText(sale.createdAt)],
    ["Payment", sale.method.toLowerCase()],
    ["Customer", sale.customerName ?? "-"],
    ["Phone", sale.customerPhone ?? "-"],
  ]);
  pdf.block("Shop", [sale.vendor.address, sale.vendor.phone, sale.vendor.gstin ? `GSTIN ${sale.vendor.gstin}` : null]);
  pdf.table(
    [{ label: "Item", width: 280 }, { label: "Qty", width: 60, align: "right" }, { label: "Price", width: 80, align: "right" }, { label: "Total", width: 79, align: "right" }],
    sale.items.map((item) => [`${item.productName}${item.variantLabel !== "Default" ? ` (${item.variantLabel})` : ""}`, String(item.quantity), rs(item.price), rs(item.lineTotal)]),
  );
  pdf.totals([["Total", rs(sale.total), true]]);
  return { filename: `${sale.number}.pdf`, buffer: await pdf.toBuffer() };
}

const builders: Record<DocumentKind, (id: string, scope: DocumentScope) => Promise<{ filename: string; buffer: Buffer }>> = {
  invoice: orderInvoice,
  statement: subscriptionStatement,
  receipt: paymentReceipt,
  payout: payoutStatement,
  bill: counterBill,
};

export function buildDocument(kind: DocumentKind, id: string, scope: DocumentScope) {
  return builders[kind](id, scope);
}

// ───────────────────────── signed download links ─────────────────────────

const LINK_TTL_MS = 15 * 60 * 1000;
const sign = (payload: string) => createHmac("sha256", env.JWT_ACCESS_SECRET).update(`doc:${payload}`).digest("base64url");

/**
 * Apps open PDFs in the system browser, which can't send the login header, so a logged-in
 * request first gets a link that works for 15 minutes for this one document and this scope.
 */
export async function documentLink(kind: DocumentKind, id: string, scope: DocumentScope) {
  await buildDocument(kind, id, scope); // proves access before handing out a link
  const payload = Buffer.from(JSON.stringify({ kind, id, scope, exp: Date.now() + LINK_TTL_MS })).toString("base64url");
  return { url: `${env.PUBLIC_URL.replace(/\/$/, "")}/api/v1/documents/download?t=${payload}.${sign(payload)}`, expiresInSeconds: LINK_TTL_MS / 1000 };
}

export async function downloadWithToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw AppError.unauthorized("Invalid link");
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw AppError.unauthorized("Invalid link");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { kind: DocumentKind; id: string; scope: DocumentScope; exp: number };
  if (data.exp < Date.now()) throw AppError.unauthorized("This link has expired. Open the document again from the app.");
  return buildDocument(data.kind, data.id, data.scope);
}
