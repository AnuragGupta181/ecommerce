import type { OrderStatus, Prisma } from "../../generated/prisma/client.js";
import { randomDigits } from "../../lib/crypto.js";
import { AppError } from "../../lib/errors.js";
import { pageMeta, toSkipTake } from "../../lib/pagination.js";
import { prisma, type Db } from "../../lib/prisma.js";
import { inBackground, notifyOrderPlaced } from "../../services/notify/index.js";
import { nextNumber } from "../../lib/numbering.js";
import { applyListingStockChange, type StockChangeResult } from "../branch-stock/branch-stock.service.js";
import { buildQuote, loadLines, loadShop, type RequestedLine } from "../cart/quote.js";
import { addressPoint, customerPoint } from "../geo/customer-point.js";
import type { Point } from "../geo/geo.js";
import { defaultListing } from "../listings/offers.service.js";
import { onOrderPlaced } from "./order-events.js";
import { changeCoins } from "../coins/coins.service.js";
import { getSettings } from "../settings/settings.service.js";
import { canCustomerCancel, canRequestReturn, TIMELINE_STEPS } from "./order-status.js";
import { transitionOrder } from "./order-transitions.js";
import type { CustomerOrderListQuery, PlaceOrderInput, QuoteInput } from "./orders.schema.js";

function generateOrderNumber(now = new Date()): string {
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, "");
  return `HT${yymmdd}${randomDigits(5)}`;
}

type Checkout = { branchId: string; lines: RequestedLine[]; fromCart: boolean };

/** Lines to buy and the shop selling them: the cart's shop, or the chosen/best shop for "buy now". */
async function checkoutLines(db: Db, userId: string, input: QuoteInput, point: Point | null): Promise<Checkout> {
  if (input.items) {
    let branchId = input.branchId;
    if (!branchId) {
      const offer = await defaultListing(db, input.items[0]!.variantId, point);
      if (!offer) throw new AppError("OUT_OF_STOCK", "No shop near you has this right now");
      branchId = offer.shop.branchId;
    }
    return { branchId, lines: input.items, fromCart: false };
  }
  const cart = await db.cartItem.findMany({ where: { userId }, select: { id: true, variantId: true, quantity: true, branchId: true } });
  const branchId = cart.find((item) => item.branchId)?.branchId;
  if (!branchId) throw AppError.badRequest("Your cart is empty");
  return {
    branchId,
    lines: cart.map((item) => ({ variantId: item.variantId, quantity: item.quantity, cartItemId: item.id })),
    fromCart: true,
  };
}

/** The selected address's point, else the browsing point / default address. */
async function destinationFor(db: Db, userId: string, addressId: string | undefined, browsing: Point | null) {
  if (addressId) {
    const address = await db.address.findFirst({ where: { id: addressId, userId }, select: { lat: true, lng: true } });
    const point = address ? addressPoint(address) : null;
    if (point) return point;
  }
  return customerPoint(db, userId, browsing);
}

/** Checkout preview: same numbers the order will be placed with. */
export async function quote(userId: string, input: QuoteInput, browsing: Point | null) {
  const point = await destinationFor(prisma, userId, input.addressId, browsing);
  const { branchId, lines: requested } = await checkoutLines(prisma, userId, input, point);
  const [branch, lines] = await Promise.all([loadShop(prisma, branchId), loadLines(prisma, branchId, requested)]);
  const { summary, shop, deliverable } = await buildQuote(prisma, userId, branch, point, lines, input);
  return { shop, items: lines, summary, deliverable };
}

export async function placeOrder(userId: string, input: PlaceOrderInput, browsing: Point | null) {
  const [settings, address] = await Promise.all([
    getSettings(),
    prisma.address.findFirst({ where: { id: input.addressId, userId } }),
  ]);
  if (!address) throw AppError.badRequest("Select a delivery address");
  if (input.paymentMethod === "COD" && !settings.codEnabled) throw AppError.badRequest("Cash on Delivery is unavailable");
  if (input.paymentMethod === "UPI_ON_DELIVERY" && !settings.upiOnDeliveryEnabled) {
    throw AppError.badRequest("UPI on Delivery is unavailable");
  }
  const point = addressPoint(address) ?? (await customerPoint(prisma, userId, browsing));

  const lowStock: StockChangeResult[] = [];
  const order = await prisma.$transaction(async (tx) => {
    const { branchId, lines: requested, fromCart } = await checkoutLines(tx, userId, input, point);
    if (requested.length === 0) throw AppError.badRequest("Your cart is empty");

    const branch = await loadShop(tx, branchId);
    const lines = await loadLines(tx, branchId, requested);
    const unavailable = lines.find((line) => !line.available);
    if (unavailable || lines.length !== requested.length) {
      throw new AppError("OUT_OF_STOCK", unavailable ? `${unavailable.product.name}: ${unavailable.unavailableReason}` : "Some items are no longer available");
    }

    const { summary, coupon, shop, distanceKm, deliverable } = await buildQuote(tx, userId, branch, point, lines, input, true);
    if (!shop.isOpen) throw new AppError("SHOP_UNAVAILABLE", `${shop.vendorName} is closed right now${shop.statusMessage ? ` (${shop.statusMessage})` : ""}`);
    if (!deliverable) throw new AppError("SHOP_UNAVAILABLE", `${shop.vendorName} does not deliver this far. Choose a nearer shop.`);

    const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: shop.vendorId }, select: { commissionBps: true } });
    const commissionAmount = Math.round((summary.itemsTotal * vendor.commissionBps) / 10_000);
    const costs = await tx.branchVariantStock.findMany({
      where: { branchId, variantId: { in: lines.map((line) => line.variant.id) } },
      select: { variantId: true, costPrice: true },
    });
    const costOf = new Map(costs.map((row) => [row.variantId, row.costPrice]));

    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        invoiceNumber: await nextNumber(tx, "INV"),
        userId,
        branchId,
        vendorId: shop.vendorId,
        paymentMethod: input.paymentMethod,
        shippingAddress: {
          name: address.name,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          type: address.type,
          lat: point?.lat ?? null,
          lng: point?.lng ?? null,
        },
        itemsMrp: summary.itemsMrp,
        itemsTotal: summary.itemsTotal,
        couponId: coupon?.id,
        couponCode: coupon?.code,
        couponDiscount: summary.couponDiscount,
        coinsUsed: summary.coinsUsed,
        deliveryFee: summary.deliveryFee,
        payable: summary.payable,
        coinsToEarn: summary.coinsToEarn,
        distanceKm,
        commissionBps: vendor.commissionBps,
        commissionAmount,
        // Coupons and coins are platform-funded, so they never reduce what the vendor earns.
        vendorEarning: summary.itemsTotal - commissionAmount + summary.deliveryFee,
        customerNote: input.note,
        items: {
          create: lines.map((line) => ({
            productId: line.product.id,
            variantId: line.variant.id,
            productName: line.product.name,
            variantLabel: line.variant.label,
            sku: line.variant.sku,
            imageUrl: line.product.imageUrl,
            mrp: line.variant.mrp,
            price: line.variant.price,
            costPrice: costOf.get(line.variant.id) ?? null,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          })),
        },
        history: { create: { status: "PLACED", actorId: userId, actorRole: "CUSTOMER" } },
      },
    });

    for (const line of lines) {
      const change = await applyListingStockChange(tx, {
        listingId: line.listingId!,
        delta: -line.quantity,
        type: "SALE",
        reason: `Order ${created.orderNumber}`,
        orderId: created.id,
        actorId: userId,
      });
      if (change?.crossedLow) lowStock.push(change);
      await tx.product.update({ where: { id: line.product.id }, data: { soldCount: { increment: line.quantity } } });
    }

    if (coupon) {
      // Conditional increment enforces the global usage limit under concurrency.
      const { count } = await tx.coupon.updateMany({
        where: { id: coupon.id, ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}) },
        data: { usedCount: { increment: 1 } },
      });
      if (count === 0) throw new AppError("COUPON_INVALID", "This coupon has just been fully redeemed");
      await tx.couponRedemption.create({
        data: { couponId: coupon.id, userId, orderId: created.id, discount: summary.couponDiscount },
      });
    }

    if (summary.coinsUsed > 0) {
      await changeCoins(tx, {
        userId,
        amount: -summary.coinsUsed,
        type: "REDEEM",
        orderId: created.id,
        note: `Redeemed on ${created.orderNumber}`,
      });
    }

    if (fromCart) await tx.cartItem.deleteMany({ where: { userId, variantId: { in: lines.map((line) => line.variant.id) } } });
    return created;
  });

  inBackground(() => notifyOrderPlaced(order.id));
  inBackground(() => onOrderPlaced(order.id, lowStock));
  return { id: order.id, orderNumber: order.orderNumber, payable: order.payable, coinsToEarn: order.coinsToEarn, status: order.status };
}

const statusFilter: Record<NonNullable<CustomerOrderListQuery["status"]>, OrderStatus[]> = {
  active: ["PLACED", "CONFIRMED", "PACKED", "RIDER_ASSIGNED", "OUT_FOR_DELIVERY"],
  delivered: ["DELIVERED"],
  cancelled: ["CANCELLED"],
  returns: ["RETURN_REQUESTED", "RETURNED", "RETURN_REJECTED"],
};

export async function listOrders(userId: string, query: CustomerOrderListQuery) {
  const where: Prisma.OrderWhereInput = { userId, ...(query.status ? { status: { in: statusFilter[query.status] } } : {}) };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(query),
      select: {
        id: true,
        orderNumber: true,
        status: true,
        payable: true,
        createdAt: true,
        deliveredAt: true,
        items: { select: { productName: true, imageUrl: true, quantity: true }, take: 4 },
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

export async function getOrder(userId: string, orderId: string) {
  const [order, settings] = await Promise.all([
    prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { product: { select: { slug: true } } } },
        history: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true } },
        rider: { select: { name: true, phone: true, whatsapp: true, vehicleType: true, vehicleNumber: true } },
        vendor: { select: { id: true, slug: true, shopName: true, phone: true } },
        branch: { select: { id: true, name: true } },
      },
    }),
    getSettings(),
  ]);
  if (!order) throw AppError.notFound("Order");
  // The shop's commission, earnings, cost prices and the admin's note are not the customer's business.
  const { adminNote: _adminNote, commissionBps: _bps, commissionAmount: _commission, vendorEarning: _earning, payoutId: _payout, ...visible } = order;

  const reviewed = await prisma.review.findMany({
    where: { userId, productId: { in: order.items.map((item) => item.productId) } },
    select: { productId: true },
  });
  const reviewedIds = new Set(reviewed.map((review) => review.productId));
  const reachedAt = new Map(order.history.map((entry) => [entry.status, entry.createdAt]));

  return {
    ...visible,
    items: order.items.map(({ product, costPrice: _cost, ...item }) => ({
      ...item,
      productSlug: product.slug,
      canReview: order.status === "DELIVERED" && !reviewedIds.has(item.productId),
    })),
    timeline: TIMELINE_STEPS.map((status) => ({ status, at: reachedAt.get(status) ?? null })),
    actions: {
      canCancel: canCustomerCancel(order.status),
      canReturn: canRequestReturn(order.status, order.deliveredAt, settings.returnWindowDays),
    },
  };
}

async function ownedOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true, status: true, deliveredAt: true } });
  if (!order) throw AppError.notFound("Order");
  return order;
}

export async function cancelOrder(userId: string, orderId: string, reason: string) {
  const order = await ownedOrder(userId, orderId);
  if (!canCustomerCancel(order.status)) {
    throw new AppError("INVALID_TRANSITION", "This order can no longer be cancelled. Please contact support.");
  }
  return transitionOrder(orderId, "CANCELLED", { actor: { id: userId, role: "CUSTOMER" }, reason });
}

export async function requestReturn(userId: string, orderId: string, reason: string) {
  const [order, settings] = await Promise.all([ownedOrder(userId, orderId), getSettings()]);
  if (!canRequestReturn(order.status, order.deliveredAt, settings.returnWindowDays)) {
    throw new AppError("INVALID_TRANSITION", "This order is not eligible for return");
  }
  return transitionOrder(orderId, "RETURN_REQUESTED", { actor: { id: userId, role: "CUSTOMER" }, reason });
}
