import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { addDays, todayIST } from "../../src/modules/pricing/subscription.js";
import { toDbDate } from "../../src/modules/subscriptions/subscription-dates.js";
import { flushNotifications } from "../../src/services/notify/index.js";
import { api, createUserSession, createVendorSession, listAtShop, TEST_POINT, unique } from "../helpers.js";

type Session = Awaited<ReturnType<typeof createUserSession>>;
type VendorSession = Awaited<ReturnType<typeof createVendorSession>>;
type Drop = { id: string; date: string; status: string; amount: number };

let admin: Session;
let customer: Session;
let stranger: Session;
let vendor: VendorSession;
let otherVendor: VendorSession;
let listingId: string;
let variantId: string;
let addressId: string;
let riderId: string;
let orderId: string;
let planId: string;
let subscriptionId: string;

const today = todayIST();
// Three days out, so every skip/pause below is well before the 8 pm cutoff whenever the suite runs.
const start = addDays(today, 3);
const PRICE = 3_000;
const FEE = 500;
const QUANTITY = 2;
/** One drop: 2 × ₹30 goods + ₹5 delivery. */
const DROP = PRICE * QUANTITY + FEE;

const stockOf = async () => (await prisma.branchVariantStock.findUniqueOrThrow({ where: { id: listingId } })).stock;
const dropOn = (drops: Drop[], date: string) => drops.find((drop) => drop.date === date)!;

beforeAll(async () => {
  admin = await createUserSession("ADMIN");
  customer = await createUserSession();
  stranger = await createUserSession();
  vendor = await createVendorSession();
  otherVendor = await createVendorSession();

  const category = await api().post("/api/v1/admin/categories").set(admin.auth).send({ name: unique("Dairy ") });
  const product = await api()
    .post("/api/v1/admin/products")
    .set(admin.auth)
    .send({ name: unique("Toned Milk "), categoryId: category.body.data.id, variants: [{ sku: unique("MILK-"), mrp: 3_500, price: 3_000, stock: 0 }] });
  variantId = product.body.data.variants[0].id;
  listingId = await listAtShop(vendor, variantId, { price: PRICE, mrp: 3_500, stock: 50, costPrice: 2_500 });

  const address = await api()
    .post("/api/v1/addresses")
    .set(customer.auth)
    .send({ name: "Asha", phone: "9876543210", line1: "12 MG Road", city: "Delhi", state: "Delhi", pincode: "110001", ...TEST_POINT });
  addressId = address.body.data.id;
  riderId = (await prisma.rider.create({ data: { name: "Milk Rider", phone: `+917${Date.now().toString().slice(-9)}`, email: "milk.rider@test.local", vendorId: vendor.vendorId } })).id;

  // One delivered order, for the order ticket and the settlement.
  await api().post("/api/v1/cart/items").set(customer.auth).send({ variantId, quantity: 1 }).expect(201);
  const order = await api().post("/api/v1/orders").set(customer.auth).send({ addressId, paymentMethod: "COD" }).expect(201);
  orderId = order.body.data.id;
  const status = (to: string) => api().patch(`/api/v1/vendor/orders/${orderId}/status`).set(vendor.auth).send({ status: to }).expect(200);
  await status("CONFIRMED");
  await api().patch(`/api/v1/vendor/orders/${orderId}/assign-rider`).set(vendor.auth).send({ riderId }).expect(200);
  await status("OUT_FOR_DELIVERY");
  await status("DELIVERED");
});

afterAll(async () => {
  await flushNotifications();
  await prisma.$disconnect();
});

describe("subscriptions", () => {
  it("lets the shop publish a plan customers can open", async () => {
    const created = await api()
      .post("/api/v1/vendor/plans")
      .set(vendor.auth)
      .send({ listingId, name: "Morning milk", slots: ["6-8 AM"], prices: [{ period: "WEEKLY", pricePerDelivery: PRICE, deliveryFee: FEE }] });
    expect(created.status).toBe(201);
    planId = created.body.data.id;

    const foreign = await api().post("/api/v1/vendor/plans").set(otherVendor.auth).send({ listingId, name: "Not mine", prices: [{ period: "WEEKLY", pricePerDelivery: 100 }] });
    expect(foreign.status).toBe(404);

    const open = await api().get(`/api/v1/plans/${planId}`).set("X-Location", `${TEST_POINT.lat},${TEST_POINT.lng}`);
    expect(open.status).toBe(200);
    expect(open.body.data.prices).toHaveLength(1);
  });

  it("quotes every date and the exact total", async () => {
    const res = await api()
      .post("/api/v1/subscriptions/quote")
      .set(customer.auth)
      .send({ planId, period: "WEEKLY", startDate: start, weekdays: 127, quantity: QUANTITY, skipDates: [addDays(start, 1)], addressId });
    expect(res.status).toBe(200);
    expect(res.body.data.schedule).toMatchObject({ startDate: start, endDate: addDays(start, 6), skipped: [addDays(start, 1)] });
    expect(res.body.data.breakdown).toMatchObject({ deliveries: 6, goodsTotal: 6 * PRICE * QUANTITY, deliveryTotal: 6 * FEE, total: 6 * DROP });
    expect(res.body.data.shop.deliverable).toBe(true);
  });

  it("rejects a start date that is not at least tomorrow", async () => {
    const res = await api().post("/api/v1/subscriptions").set(customer.auth).send({ planId, period: "WEEKLY", startDate: today, weekdays: 127, addressId });
    expect(res.status).toBe(400);
    const noPrice = await api().post("/api/v1/subscriptions/quote").set(customer.auth).send({ planId, period: "MONTHLY", startDate: start, weekdays: 127 });
    expect(noPrice.status).toBe(400);
  });

  it("subscribes with a schedule, instalments and a shop notice", async () => {
    const res = await api()
      .post("/api/v1/subscriptions")
      .set(customer.auth)
      .send({ planId, period: "WEEKLY", startDate: start, weekdays: 127, quantity: QUANTITY, slot: "6-8 AM", skipDates: [addDays(start, 1)], addressId, paymentPlan: "TWO_INSTALMENTS" });
    expect(res.status).toBe(201);
    subscriptionId = res.body.data.id;
    const drops: Drop[] = res.body.data.deliveries;
    expect(drops).toHaveLength(7);
    expect(drops.filter((drop) => drop.status === "SCHEDULED")).toHaveLength(6);
    expect(dropOn(drops, addDays(start, 1)).status).toBe("SKIPPED");
    expect(res.body.data.ledger).toMatchObject({ charged: 0, paid: 0, expectedTotal: 6 * DROP });
    const instalments: { amount: number }[] = res.body.data.ledger.instalments;
    expect(instalments).toHaveLength(2);
    expect(instalments.reduce((sum, row) => sum + row.amount, 0)).toBe(6 * DROP);

    await flushNotifications();
    const notices = await prisma.notificationLog.findMany({ where: { template: { in: ["subscription_new_vendor", "subscription_new_customer"] } } });
    expect(new Set(notices.map((log) => log.template))).toEqual(new Set(["subscription_new_vendor", "subscription_new_customer"]));
  });

  it("skips and restores a day, keeping instalments equal to what will be delivered", async () => {
    const day = addDays(start, 2);
    const skipped = await api().post(`/api/v1/subscriptions/${subscriptionId}/skip`).set(customer.auth).send({ date: day });
    expect(dropOn(skipped.body.data.deliveries, day).status).toBe("SKIPPED");
    expect(skipped.body.data.ledger.expectedTotal).toBe(5 * DROP);
    const instalments: { amount: number }[] = skipped.body.data.ledger.instalments;
    expect(instalments.reduce((sum, row) => sum + row.amount, 0)).toBe(5 * DROP);

    const restored = await api().post(`/api/v1/subscriptions/${subscriptionId}/skip`).set(customer.auth).send({ date: day, skip: false });
    expect(restored.body.data.ledger.expectedTotal).toBe(6 * DROP);

    const noDrop = await api().post(`/api/v1/subscriptions/${subscriptionId}/skip`).set(customer.auth).send({ date: addDays(start, 20) });
    expect(noDrop.status).toBe(400);
  });

  it("pauses a range and resumes it", async () => {
    const paused = await api().post(`/api/v1/subscriptions/${subscriptionId}/pauses`).set(customer.auth).send({ fromDate: addDays(start, 3), toDate: addDays(start, 4) });
    expect(paused.status).toBe(200);
    expect(paused.body.data.ledger.expectedTotal).toBe(4 * DROP);
    const pauseId = paused.body.data.pauses[0].id;

    const resumed = await api().delete(`/api/v1/subscriptions/${subscriptionId}/pauses/${pauseId}`).set(customer.auth);
    expect(resumed.body.data.pauses).toHaveLength(0);
    expect(resumed.body.data.ledger.expectedTotal).toBe(6 * DROP);
  });

  it("keeps a subscription private to its customer and its shop", async () => {
    expect((await api().get(`/api/v1/subscriptions/${subscriptionId}`).set(stranger.auth)).status).toBe(404);
    expect((await api().get(`/api/v1/vendor/subscriptions/${subscriptionId}`).set(otherVendor.auth)).status).toBe(404);
    const list = await api().get("/api/v1/vendor/subscriptions").set(vendor.auth);
    expect(list.body.data.map((row: { id: string }) => row.id)).toContain(subscriptionId);
  });

  it("assigns a delivery partner and sends them a private schedule link", async () => {
    const otherRider = await prisma.rider.create({ data: { name: "Elsewhere", phone: `+916${Date.now().toString().slice(-9)}`, vendorId: otherVendor.vendorId } });
    expect((await api().patch(`/api/v1/vendor/subscriptions/${subscriptionId}/rider`).set(vendor.auth).send({ riderId: otherRider.id })).status).toBe(400);

    const assigned = await api().patch(`/api/v1/vendor/subscriptions/${subscriptionId}/rider`).set(vendor.auth).send({ riderId });
    expect(assigned.body.data.rider).toMatchObject({ id: riderId });
    await flushNotifications();
    const rider = await prisma.rider.findUniqueOrThrow({ where: { id: riderId } });
    expect(rider.linkToken).toBeTruthy();
    expect(await prisma.notificationLog.count({ where: { template: "rider_schedule_link", recipientType: "RIDER" } })).toBeGreaterThan(0);
  });

  it("delivers today's drop once, taking stock, and refuses future drops", async () => {
    const detail = await api().get(`/api/v1/vendor/subscriptions/${subscriptionId}`).set(vendor.auth);
    const future = dropOn(detail.body.data.deliveries, addDays(start, 5));
    const early = await api().post("/api/v1/vendor/deliveries/delivered").set(vendor.auth).send({ ids: [future.id] });
    expect(early.body.data.delivered).toHaveLength(0);
    expect(early.body.data.failed[0].reason).toMatch(/future/);

    // Bring the first drop forward to today so it can be delivered now.
    const first = dropOn(detail.body.data.deliveries, start);
    await prisma.subscriptionDelivery.update({ where: { id: first.id }, data: { date: toDbDate(today) } });

    const board = await api().get(`/api/v1/vendor/deliveries?date=${today}`).set(vendor.auth);
    expect(board.body.data.counts.scheduled).toBe(1);
    expect(board.body.data.toLoad[0].quantity).toBe(QUANTITY);

    const before = await stockOf();
    const done = await api().post("/api/v1/vendor/deliveries/delivered").set(vendor.auth).send({ ids: [first.id] });
    expect(done.body.data.delivered).toEqual([first.id]);
    expect(await stockOf()).toBe(before - QUANTITY);
    await api().post("/api/v1/vendor/deliveries/delivered").set(vendor.auth).send({ ids: [first.id] }).expect(200);
    expect(await stockOf()).toBe(before - QUANTITY);

    const { linkToken } = await prisma.rider.findUniqueOrThrow({ where: { id: riderId } });
    const schedule = await api().get(`/api/v1/rider-schedule/${linkToken}?date=${today}`);
    expect(schedule.body.data.today).toMatchObject([{ id: first.id, status: "DELIVERED" }]);
    expect(schedule.body.data.month.length).toBeGreaterThan(0);
    expect((await api().get(`/api/v1/rider-schedule/${"x".repeat(32)}`)).status).toBe(404);
  });

  it("records a payment against what was delivered", async () => {
    const payment = await api().post(`/api/v1/vendor/subscriptions/${subscriptionId}/payments`).set(vendor.auth).send({ amount: DROP, method: "UPI" });
    expect(payment.status).toBe(201);
    expect(payment.body.data.receiptNumber).toMatch(/^RCPT-/);
    const mine = await api().get(`/api/v1/subscriptions/${subscriptionId}`).set(customer.auth);
    expect(mine.body.data.ledger).toMatchObject({ charged: DROP, paid: DROP, balance: 0 });
  });

  it("renews into the next period, then cancels the original keeping delivered drops", async () => {
    const renewed = await api().post(`/api/v1/subscriptions/${subscriptionId}/renew`).set(customer.auth);
    expect(renewed.status).toBe(201);
    expect(renewed.body.data.startDate).toBe(addDays(start, 7));

    const cancelled = await api().post(`/api/v1/subscriptions/${subscriptionId}/cancel`).set(customer.auth).send({ reason: "Moving house" });
    expect(cancelled.body.data.status).toBe("CANCELLED");
    const statuses = new Set(cancelled.body.data.deliveries.map((drop: Drop) => drop.status));
    expect(statuses).toEqual(new Set(["DELIVERED", "CANCELLED"]));
    expect(cancelled.body.data.ledger).toMatchObject({ charged: DROP, expectedTotal: DROP, balance: 0 });
    expect((await api().post(`/api/v1/subscriptions/${subscriptionId}/skip`).set(customer.auth).send({ date: addDays(start, 5) })).status).toBe(400);
  });
});

describe("tickets", () => {
  let orderTicketId: string;
  let appTicketId: string;

  it("needs the order for an order issue, and only the customer's own", async () => {
    const missing = await api().post("/api/v1/tickets").set(customer.auth).send({ category: "ORDER_ISSUE", subject: "Leaking pack", message: "The milk pack was leaking." });
    expect(missing.status).toBe(422);
    const notMine = await api().post("/api/v1/tickets").set(stranger.auth).send({ category: "ORDER_ISSUE", subject: "Leaking pack", message: "The milk pack was leaking.", orderId });
    expect(notMine.status).toBe(400);
  });

  it("routes an order issue to the shop and an app bug to the platform", async () => {
    const order = await api().post("/api/v1/tickets").set(customer.auth).send({ category: "ORDER_ISSUE", subject: "Leaking pack", message: "The milk pack was leaking.", orderId });
    expect(order.status).toBe(201);
    expect(order.body.data).toMatchObject({ level: "MINOR", vendorId: vendor.vendorId, handledBy: "SHOP", status: "OPEN" });
    expect(order.body.data.context).toBeUndefined();
    orderTicketId = order.body.data.id;

    const bug = await api().post("/api/v1/tickets").set(customer.auth).send({ category: "APP_BUG", subject: "App froze", message: "The app froze on checkout." });
    expect(bug.body.data).toMatchObject({ level: "MAJOR", handledBy: "PLATFORM" });
    appTicketId = bug.body.data.id;

    await flushNotifications();
    const templates = (await prisma.notificationLog.findMany({ where: { template: { in: ["ticket_new_vendor", "ticket_new_admin"] } } })).map((log) => log.template);
    expect(templates).toEqual(expect.arrayContaining(["ticket_new_vendor", "ticket_new_admin"]));
  });

  it("shows the shop only its minor tickets, with the order context", async () => {
    const list = await api().get("/api/v1/vendor/tickets").set(vendor.auth);
    const ids = list.body.data.map((row: { id: string }) => row.id);
    expect(ids).toContain(orderTicketId);
    expect(ids).not.toContain(appTicketId);
    expect((await api().get(`/api/v1/vendor/tickets/${appTicketId}`).set(vendor.auth)).status).toBe(404);
    expect((await api().get(`/api/v1/vendor/tickets/${orderTicketId}`).set(otherVendor.auth)).status).toBe(404);

    const detail = await api().get(`/api/v1/vendor/tickets/${orderTicketId}`).set(vendor.auth);
    expect(detail.body.data.context.order.id).toBe(orderId);
    expect(detail.body.data.context.customer.deliveredOrders).toBe(1);
  });

  it("moves to in progress when the shop replies, and the customer is told", async () => {
    const reply = await api().post(`/api/v1/vendor/tickets/${orderTicketId}/messages`).set(vendor.auth).send({ body: "Sorry! A fresh pack is on its way." });
    expect(reply.status).toBe(201);
    expect(reply.body.data.status).toBe("IN_PROGRESS");

    const mine = await api().get(`/api/v1/tickets/${orderTicketId}`).set(customer.auth);
    const last = mine.body.data.messages.at(-1);
    expect(last).toMatchObject({ authorRole: "VENDOR", mine: false });
    await flushNotifications();
    expect(await prisma.notification.count({ where: { userId: customer.user.id, type: "SUPPORT" } })).toBe(1);
  });

  it("lets the admin escalate away from the shop and hand back", async () => {
    const up = await api().patch(`/api/v1/admin/tickets/${orderTicketId}/level`).set(admin.auth).send({ level: "MAJOR" });
    expect(up.body.data.handledBy).toBe("PLATFORM");
    expect((await api().get(`/api/v1/vendor/tickets/${orderTicketId}`).set(vendor.auth)).status).toBe(404);

    const down = await api().patch(`/api/v1/admin/tickets/${orderTicketId}/level`).set(admin.auth).send({ level: "MINOR" });
    expect(down.body.data.handledBy).toBe("SHOP");
    expect((await api().get(`/api/v1/vendor/tickets/${orderTicketId}`).set(vendor.auth)).status).toBe(200);

    expect((await api().patch(`/api/v1/admin/tickets/${appTicketId}/level`).set(admin.auth).send({ level: "MINOR" })).status).toBe(400);
    expect((await api().patch(`/api/v1/admin/tickets/${appTicketId}/level`).set(vendor.auth).send({ level: "MAJOR" })).status).toBe(403);
  });

  it("resolves, reopens on a customer reply, and stays shut once closed", async () => {
    expect((await api().patch(`/api/v1/tickets/${orderTicketId}/status`).set(customer.auth).send({ status: "RESOLVED" })).status).toBe(403);
    const resolved = await api().patch(`/api/v1/vendor/tickets/${orderTicketId}/status`).set(vendor.auth).send({ status: "RESOLVED", note: "Replacement delivered" });
    expect(resolved.body.data.status).toBe("RESOLVED");

    const reopened = await api().post(`/api/v1/tickets/${orderTicketId}/messages`).set(customer.auth).send({ body: "The new one leaks too." });
    expect(reopened.body.data.status).toBe("OPEN");

    const closed = await api().patch(`/api/v1/tickets/${orderTicketId}/status`).set(customer.auth).send({ status: "CLOSED" });
    expect(closed.body.data.status).toBe("CLOSED");
    expect((await api().post(`/api/v1/tickets/${orderTicketId}/messages`).set(customer.auth).send({ body: "Hello?" })).status).toBe(400);

    const counts = await api().get("/api/v1/tickets/counts").set(customer.auth);
    expect(counts.body.data).toMatchObject({ CLOSED: 1, OPEN: 1 });
  });
});

describe("payouts", () => {
  const period = { from: today, to: today };
  let payoutId: string;

  it("previews the period: the delivered order plus the delivered subscription drop", async () => {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const res = await api().get("/api/v1/vendor/payouts/upcoming").query(period).set(vendor.auth);
    expect(res.status).toBe(200);
    const dropGoods = PRICE * QUANTITY;
    const dropCommission = Math.round((dropGoods * 1000) / 10_000);
    expect(res.body.data).toMatchObject({
      orderCount: 1,
      deliveryCount: 1,
      grossAmount: order.itemsTotal + order.deliveryFee + DROP,
      commissionAmount: order.commissionAmount + dropCommission,
      collectedByVendor: order.payable + DROP,
      vendorEarning: order.vendorEarning + DROP - dropCommission,
    });
    expect(res.body.data.netAmount).toBe(res.body.data.vendorEarning - res.body.data.collectedByVendor);
  });

  it("validates the period and keeps payouts admin-only", async () => {
    expect((await api().post("/api/v1/admin/payouts").set(admin.auth).send({ vendorId: vendor.vendorId, from: today, to: addDays(today, -1) })).status).toBe(422);
    expect((await api().post("/api/v1/admin/payouts").set(vendor.auth).send({ vendorId: vendor.vendorId, ...period })).status).toBe(403);
  });

  it("settles each sale exactly once", async () => {
    const created = await api().post("/api/v1/admin/payouts").set(admin.auth).send({ vendorId: vendor.vendorId, ...period, note: "Test week" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: "PENDING", orderCount: 1, deliveryCount: 1 });
    expect(created.body.data.number).toMatch(/^PAY-/);
    payoutId = created.body.data.id;
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).payoutId).toBe(payoutId);

    const again = await api().post("/api/v1/admin/payouts").set(admin.auth).send({ vendorId: vendor.vendorId, ...period });
    expect(again.status).toBe(400);
    const upcoming = await api().get("/api/v1/vendor/payouts/upcoming").query(period).set(vendor.auth);
    expect(upcoming.body.data).toMatchObject({ orderCount: 0, deliveryCount: 0, netAmount: 0 });
    expect(await prisma.auditLog.count({ where: { action: "payout.create", entityId: payoutId } })).toBe(1);
  });

  it("shows the statement to its shop only", async () => {
    const list = await api().get("/api/v1/vendor/payouts").set(vendor.auth);
    expect(list.body.data.map((row: { id: string }) => row.id)).toEqual([payoutId]);
    const detail = await api().get(`/api/v1/vendor/payouts/${payoutId}`).set(vendor.auth);
    expect(detail.body.data.orders).toHaveLength(1);
    expect(detail.body.data.deliveries).toHaveLength(1);
    expect((await api().get(`/api/v1/vendor/payouts/${payoutId}`).set(otherVendor.auth)).status).toBe(404);
  });

  it("is marked paid once, with a reference, and the shop is told", async () => {
    const paid = await api().post(`/api/v1/admin/payouts/${payoutId}/paid`).set(admin.auth).send({ reference: "UTR-0001" });
    expect(paid.body.data).toMatchObject({ status: "PAID", reference: "UTR-0001" });
    expect((await api().post(`/api/v1/admin/payouts/${payoutId}/paid`).set(admin.auth).send({ reference: "UTR-0002" })).status).toBe(409);
    await flushNotifications();
    expect(await prisma.notificationLog.count({ where: { template: "payout_paid" } })).toBeGreaterThan(0);
  });
});
