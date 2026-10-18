import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { flushNotifications } from "../../src/services/notify/index.js";
import { api, createUserSession, createVendorSession, listAtShop, TEST_POINT, unique } from "../helpers.js";

type Session = Awaited<ReturnType<typeof createUserSession>>;

let admin: Session;
let vendor: Awaited<ReturnType<typeof createVendorSession>>;
let listingId: string;
let customer: Session;
let productId: string;
let variantId: string;
let addressId: string;
let riderId: string;
let couponCode: string;

// Stock lives on the shop's listing, not the catalog variant.
const stockOf = async () => (await prisma.branchVariantStock.findUniqueOrThrow({ where: { id: listingId } })).stock;
const coinsOf = async () => (await prisma.user.findUniqueOrThrow({ where: { id: customer.user.id } })).coinBalance;

beforeAll(async () => {
  admin = await createUserSession("ADMIN");
  customer = await createUserSession();
  vendor = await createVendorSession();

  const category = await api().post("/api/v1/admin/categories").set(admin.auth).send({ name: unique("Snacks ") });
  const product = await api()
    .post("/api/v1/admin/products")
    .set(admin.auth)
    .send({
      name: unique("Masala Chips "),
      categoryId: category.body.data.id,
      variants: [{ sku: unique("CHIPS-"), mrp: 40_000, price: 30_000, stock: 0 }],
    });
  productId = product.body.data.id;
  variantId = product.body.data.variants[0].id;
  listingId = await listAtShop(vendor, variantId, { price: 30_000, mrp: 40_000, stock: 5, costPrice: 20_000 });

  couponCode = unique("T").toUpperCase().slice(0, 12);
  await api()
    .post("/api/v1/admin/coupons")
    .set(admin.auth)
    .send({ code: couponCode, type: "FLAT", value: 5_000, minOrderValue: 50_000, perUserLimit: 1 });

  const rider = await api()
    .post("/api/v1/admin/riders")
    .set(admin.auth)
    .send({ name: "Test Rider", phone: `9${Date.now().toString().slice(-9)}`, email: "rider@test.local", vehicleNumber: "dl01x1", vendorId: vendor.vendorId });
  riderId = rider.body.data.id;

  const address = await api()
    .post("/api/v1/addresses")
    .set(customer.auth)
    .send({ name: "Asha", phone: "9876543210", line1: "12 MG Road", city: "Delhi", state: "Delhi", pincode: "110001", ...TEST_POINT });
  addressId = address.body.data.id;
});

afterAll(() => prisma.$disconnect());

describe("shopping → order → delivery", () => {
  it("requires login for cart and wishlist", async () => {
    expect((await api().post("/api/v1/cart/items").send({ variantId })).status).toBe(401);
    expect((await api().put(`/api/v1/wishlist/${productId}`)).status).toBe(401);
  });

  it("manages the wishlist", async () => {
    await api().put(`/api/v1/wishlist/${productId}`).set(customer.auth).expect(204);
    const list = await api().get("/api/v1/wishlist").set(customer.auth);
    expect(list.body.data.map((p: { id: string }) => p.id)).toContain(productId);
    const detail = await api().get(`/api/v1/products?ids=${productId}`).set(customer.auth);
    expect(detail.body.data[0].isWishlisted).toBe(true);
  });

  it("prices the cart with a coupon and reports coupon problems without failing", async () => {
    await api().post("/api/v1/cart/items").set(customer.auth).send({ variantId, quantity: 2 }).expect(201);

    const cart = await api().get(`/api/v1/cart?coupon=${couponCode}`).set(customer.auth);
    expect(cart.body.data.items).toHaveLength(1);
    expect(cart.body.data.summary).toMatchObject({
      itemsMrp: 80_000,
      itemsTotal: 60_000,
      couponDiscount: 5_000,
      deliveryFee: 0,
      payable: 55_000,
    });

    const bad = await api().get("/api/v1/cart?coupon=NOPE123").set(customer.auth);
    expect(bad.body.data.summary.couponError).toMatch(/invalid or has expired/);

    const tooMany = await api().post("/api/v1/cart/items").set(customer.auth).send({ variantId, quantity: 9 });
    expect(tooMany.status).toBe(409);
  });

  it("places an order atomically: stock, coupon, coins and cart all update", async () => {
    await api().post(`/api/v1/admin/customers/${customer.user.id}/coins`).set(admin.auth).send({ amount: 50, note: "Welcome bonus" }).expect(200);

    const res = await api()
      .post("/api/v1/orders")
      .set(customer.auth)
      .send({ addressId, paymentMethod: "COD", couponCode, useCoins: true });
    expect(res.status).toBe(201);
    // ₹600 − ₹50 coupon = ₹550; coin cap 20% = 110 → uses all 50 coins → ₹500
    expect(res.body.data.payable).toBe(50_000);

    expect(await stockOf()).toBe(3);
    expect(await coinsOf()).toBe(0);
    const cart = await api().get("/api/v1/cart/count").set(customer.auth);
    expect(cart.body.data.count).toBe(0);
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: couponCode } });
    expect(coupon.usedCount).toBe(1);

    const reuse = await api().post("/api/v1/cart/items").set(customer.auth).send({ variantId, quantity: 2 });
    expect(reuse.status).toBe(201);
    const again = await api().post("/api/v1/orders").set(customer.auth).send({ addressId, paymentMethod: "COD", couponCode });
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe("COUPON_INVALID");
  });

  it("rejects an order that exceeds stock without writing anything", async () => {
    const ordersBefore = await prisma.order.count({ where: { userId: customer.user.id } });
    const res = await api()
      .post("/api/v1/orders")
      .set(customer.auth)
      .send({ addressId, paymentMethod: "COD", items: [{ variantId, quantity: 4 }] });
    expect(res.status).toBe(409);
    expect(await prisma.order.count({ where: { userId: customer.user.id } })).toBe(ordersBefore);
    expect(await stockOf()).toBe(3);
  });

  it("fulfils the order: rider assignment notifies everyone and delivery credits coins", async () => {
    const order = await prisma.order.findFirstOrThrow({ where: { userId: customer.user.id }, orderBy: { createdAt: "asc" } });
    const status = (to: string) => api().patch(`/api/v1/admin/orders/${order.id}/status`).set(admin.auth).send({ status: to });

    expect((await status("OUT_FOR_DELIVERY")).status).toBe(409);
    expect((await status("CONFIRMED")).status).toBe(200);

    const inactive = await prisma.rider.create({ data: { name: "Off Duty", phone: `+918${Date.now().toString().slice(-9)}`, isActive: false, vendorId: vendor.vendorId } });
    const otherShopRider = await prisma.rider.create({ data: { name: "Elsewhere", phone: `+917${Date.now().toString().slice(-9)}`, vendorId: (await createVendorSession()).vendorId } });
    const wrongShop = await api().patch(`/api/v1/admin/orders/${order.id}/assign-rider`).set(admin.auth).send({ riderId: otherShopRider.id });
    expect(wrongShop.status).toBe(400);
    const rejected = await api().patch(`/api/v1/admin/orders/${order.id}/assign-rider`).set(admin.auth).send({ riderId: inactive.id });
    expect(rejected.status).toBe(400);

    const assigned = await api().patch(`/api/v1/admin/orders/${order.id}/assign-rider`).set(admin.auth).send({ riderId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data).toMatchObject({ status: "RIDER_ASSIGNED", rider: { id: riderId } });
    expect(assigned.body.data.whatsappLinks.rider).toMatch(/^https:\/\/wa\.me\/91\d{10}\?text=/);

    await flushNotifications();
    const logs = await prisma.notificationLog.findMany({ where: { orderId: order.id, template: "rider_assigned" } });
    expect(logs.map((log) => `${log.recipientType}:${log.channel}`).sort()).toEqual(
      ["ADMIN:EMAIL", "ADMIN:WHATSAPP", "CUSTOMER:EMAIL", "CUSTOMER:WHATSAPP", "RIDER:EMAIL", "RIDER:WHATSAPP"].sort(),
    );
    expect(logs.find((log) => log.recipientType === "CUSTOMER")?.body).toContain("Test Rider");

    const customerView = await api().get(`/api/v1/orders/${order.id}`).set(customer.auth);
    expect(customerView.body.data.rider).toMatchObject({ name: "Test Rider" });
    expect(customerView.body.data.actions.canCancel).toBe(false);

    expect((await status("OUT_FOR_DELIVERY")).status).toBe(200);
    expect((await status("DELIVERED")).status).toBe(200);
    expect(await coinsOf()).toBe(order.coinsToEarn);
    expect(order.coinsToEarn).toBe(10);

    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ vendorId: vendor.vendorId, commissionBps: 1000, commissionAmount: 6_000, vendorEarning: 54_000 });

    const review = await api().post("/api/v1/reviews").set(customer.auth).send({ productId, rating: 5, comment: "Crunchy!" });
    expect(review.status).toBe(201);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product).toMatchObject({ ratingAvg: 5, ratingCount: 1 });
  });

  it("lets the customer cancel before dispatch and restores stock", async () => {
    const placed = await api()
      .post("/api/v1/orders")
      .set(customer.auth)
      .send({ addressId, paymentMethod: "UPI_ON_DELIVERY", items: [{ variantId, quantity: 1 }] });
    expect(placed.status).toBe(201);
    expect(await stockOf()).toBe(2);

    const cancelled = await api().post(`/api/v1/orders/${placed.body.data.id}/cancel`).set(customer.auth).send({ reason: "Changed my mind" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
    expect(await stockOf()).toBe(3);

    const again = await api().post(`/api/v1/orders/${placed.body.data.id}/cancel`).set(customer.auth).send({ reason: "Twice" });
    expect(again.status).toBe(409);
  });

  it("shows the dashboard to admins", async () => {
    const res = await api().get("/api/v1/admin/dashboard?days=7").set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.series).toHaveLength(7);
    expect(res.body.data.kpis.orders.value).toBeGreaterThanOrEqual(1);
  });
});
