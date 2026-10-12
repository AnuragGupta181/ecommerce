#!/usr/bin/env node
/**
 * End-to-end smoke test against a running API (seeded database).
 * Plays guest → customer → admin → customer through the whole order lifecycle and
 * checks the response fields the mobile app and admin dashboard read.
 *
 *   node --env-file=backend/.env tests/smoke/run.mjs
 *
 * Env: API_URL (default http://localhost:4000/api/v1), ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD.
 * It creates a throwaway customer (smoke+<timestamp>@haat.test) and two orders; run it on a dev database.
 */

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? "admin@haat.local";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;

let passed = 0;
const failures = [];

async function call(method, path, { token, body, expect = [200, 201, 204] } = {}) {
  const res = await fetch(`${API}${path}`, {
    signal: AbortSignal.timeout(30_000),
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch((error) => {
    throw new Error(`${method} ${path} → ${error.name === "TimeoutError" ? "no response in 30 s" : error.message}`);
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!expect.includes(res.status)) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.error ?? json)}`);
  }
  return json;
}
const get = (path, token) => call("GET", path, { token }).then((r) => r.data);
const post = (path, body, token) => call("POST", path, { token, body }).then((r) => r?.data);
const patch = (path, body, token) => call("PATCH", path, { token, body }).then((r) => r?.data);
const put = (path, token) => call("PUT", path, { token }).then((r) => r?.data);

async function step(name, fn) {
  try {
    const value = await fn();
    passed++;
    console.log(`  ✓ ${name}`);
    return value;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`  ✗ ${name}\n      ${error.message}`);
    return undefined;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Fails when any field a client reads is missing from the payload. */
function hasKeys(object, keys, label) {
  assert(object && typeof object === "object", `${label}: expected an object`);
  const missing = keys.filter((key) => !(key in object));
  assert(missing.length === 0, `${label} is missing ${missing.join(", ")}`);
}

const CARD_KEYS = ["id", "slug", "name", "brand", "imageUrl", "price", "mrp", "discountPercent", "ratingAvg", "ratingCount", "inStock", "defaultVariantId", "isWishlisted"];
const SUMMARY_KEYS = ["itemCount", "itemsMrp", "mrpDiscount", "couponCode", "couponDiscount", "couponError", "coinsAvailable", "coinsRedeemable", "coinsUsed", "coinsDiscount", "deliveryFee", "amountForFreeDelivery", "payable", "totalSavings", "coinsToEarn"];

async function main() {
  console.log(`Smoke test against ${API}\n`);
  await step("API is up", async () => assert((await call("GET", "/health")) !== null, "no health response"));

  console.log("\nGuest browsing");
  const home = await step("home feed", async () => {
    const data = await get("/home");
    hasKeys(data, ["banners", "categories", "rails"], "home");
    hasKeys(data.banners, ["carousel", "strip"], "home.banners");
    assert(data.rails.length > 0, "no rails");
    hasKeys(data.rails[0], ["key", "title", "items", "query"], "rail");
    if (data.rails[0].items[0]) hasKeys(data.rails[0].items[0], CARD_KEYS, "product card");
    return data;
  });
  await step("category tree", async () => {
    const tree = await get("/categories");
    assert(tree.length > 0 && Array.isArray(tree[0].children), "expected top-level categories with children");
  });
  const product = await step("pick an in-stock product", async () => {
    const page = await call("GET", "/products?inStock=true&sort=popular&limit=20");
    hasKeys(page.meta, ["page", "totalPages", "total"], "list meta");
    const card = page.data.find((p) => p.defaultVariantId && p.price < 300_000);
    assert(card, "no in-stock product under ₹3,000");
    hasKeys(card, CARD_KEYS, "product card");
    return card;
  });
  await step("listing filters, facets, suggestions, trending", async () => {
    const category = home?.categories[0]?.slug;
    await get(`/products?sort=price_asc&rating=3${category ? `&category=${category}` : ""}`);
    hasKeys(await get("/products/facets"), ["brands", "price"], "facets");
    hasKeys(await get(`/products/suggestions?q=${encodeURIComponent(product?.name.slice(0, 4) ?? "rice")}`), ["products", "categories", "brands"], "suggestions");
    assert(Array.isArray(await get("/products/trending-searches")), "trending is not a list");
  });
  const detail = await step("product detail + similar + reviews", async () => {
    const data = await get(`/products/${product.slug}`);
    hasKeys(data, ["images", "variants", "rating", "topReviews", "offers", "highlights", "specs", "category", "isWishlisted"], "product detail");
    hasKeys(data.variants[0], ["id", "label", "price", "mrp", "inStock", "stock"], "variant");
    hasKeys(data.rating, ["average", "count", "breakdown"], "rating");
    await get(`/products/${product.slug}/similar`);
    await call("GET", `/reviews?productId=${data.id}&sort=recent`);
    return data;
  });
  await step("public settings + offers", async () => {
    hasKeys(await get("/settings"), ["deliveryFee", "freeDeliveryThreshold", "codEnabled", "upiOnDeliveryEnabled", "supportPhone"], "settings");
    assert(Array.isArray(await get("/coupons")), "coupons is not a list");
  });
  await step("guest cannot reach the cart", async () => {
    await call("GET", "/cart", { expect: [401] });
  });

  console.log("\nCustomer: account and cart");
  const stamp = Date.now();
  const email = `smoke+${stamp}@haat.test`;
  const password = "Smoke-test-1234";
  const phone = `9${String(stamp).slice(-9)}`;
  await step("register", async () => {
    const session = await post("/auth/register", { name: "Smoke Tester", email, phone, password });
    hasKeys(session, ["user", "accessToken", "refreshToken"], "session");
  });
  const customer = await step("login by phone", async () => post("/auth/login", { identifier: phone, password }));
  if (!customer || !product || !detail) return;
  let token = customer.accessToken;

  await step("refresh rotates the session", async () => {
    const next = await post("/auth/refresh", { refreshToken: customer.refreshToken });
    assert(next.refreshToken !== customer.refreshToken, "refresh token did not rotate");
    token = next.accessToken;
  });
  await step("me", async () => hasKeys(await get("/auth/me", token), ["id", "name", "email", "role", "coinBalance"], "user"));
  const address = await step("add address", async () =>
    post("/addresses", { name: "Smoke Tester", phone, line1: "12 Test Street", city: "Jaipur", state: "Rajasthan", pincode: "302001", type: "HOME", isDefault: true }, token),
  );
  await step("wishlist toggle shows the heart", async () => {
    await put(`/wishlist/${product.id}`, token);
    assert((await get(`/products/${product.slug}`, token)).isWishlisted === true, "isWishlisted not set");
    assert((await get("/wishlist", token)).some((p) => p.id === product.id), "not in wishlist");
  });

  const variant = detail.variants.find((v) => v.inStock);
  const stockBefore = variant.stock;
  await step("add to cart + badge count", async () => {
    await post("/cart/items", { variantId: variant.id, quantity: 2 }, token);
    assert((await get("/cart/count", token)).count >= 1, "cart count is 0");
  });
  await step("cart with server price summary", async () => {
    const data = await get("/cart", token);
    hasKeys(data.items[0], ["id", "quantity", "maxQuantity", "available", "lineMrp", "lineTotal", "variant", "product"], "cart line");
    hasKeys(data.summary, SUMMARY_KEYS, "price summary");
    assert(data.summary.payable === data.summary.itemsTotal - data.summary.couponDiscount - data.summary.coinsDiscount + data.summary.deliveryFee, "payable does not add up");
    return data;
  });
  const coupon = await step("cart coupons + apply one", async () => {
    const coupons = await get("/cart/coupons", token);
    const usable = coupons.find((c) => c.applicable);
    if (!usable) return undefined;
    const priced = await get(`/cart?coupon=${usable.code}`, token);
    assert(priced.summary.couponError === null && priced.summary.couponDiscount > 0, `coupon ${usable.code} did not apply: ${priced.summary.couponError}`);
    return usable.code;
  });
  await step("bad coupon reports an error instead of failing", async () => {
    const priced = await get("/cart?coupon=NOPE-NOT-REAL", token);
    assert(priced.summary.couponError, "expected couponError");
  });
  const quote = await step("checkout quote", async () => post("/orders/quote", { couponCode: coupon }, token));

  console.log("\nCustomer: place order");
  const order = await step("place COD order", async () => {
    const placed = await post("/orders", { addressId: address.id, paymentMethod: "COD", couponCode: coupon, note: "Smoke test" }, token);
    hasKeys(placed, ["id", "orderNumber", "payable", "coinsToEarn"], "placed order");
    assert(placed.payable === quote.summary.payable, `order payable ${placed.payable} ≠ quote ${quote.summary.payable}`);
    return placed;
  });
  if (!order) return;
  await step("cart is empty after ordering", async () => assert((await get("/cart/count", token)).count === 0, "cart not cleared"));
  await step("stock was reserved", async () => {
    const after = (await get(`/products/${product.slug}`)).variants.find((v) => v.id === variant.id);
    if (stockBefore !== null && after.stock !== null) assert(after.stock === stockBefore - 2, `stock ${stockBefore} → ${after.stock}`);
  });
  await step("order shows in active orders", async () => {
    const list = await call("GET", "/orders?status=active", { token });
    const row = list.data.find((o) => o.id === order.id);
    assert(row, "order missing from active list");
    hasKeys(row, ["orderNumber", "status", "payable", "createdAt", "items", "itemCount"], "order summary");
  });
  await step("order detail before dispatch", async () => {
    const data = await get(`/orders/${order.id}`, token);
    hasKeys(data, ["timeline", "history", "rider", "actions", "shippingAddress", "items"], "order detail");
    assert(data.status === "PLACED" && data.actions.canCancel, "expected PLACED and cancellable");
  });

  console.log("\nAdmin: fulfil the order");
  if (!ADMIN_PASSWORD) {
    failures.push("ADMIN_SEED_PASSWORD is not set; skipped admin steps");
    return;
  }
  const admin = await step("admin login", async () => {
    const session = await post("/auth/login", { identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    assert(session.user.role === "ADMIN", "not an admin");
    return session;
  });
  if (!admin) return;
  const at = admin.accessToken;
  await step("customer token is refused on admin routes", async () => {
    await call("GET", "/admin/dashboard", { token, expect: [403] });
  });
  await step("dashboard + status counts", async () => {
    await get("/admin/dashboard?days=30", at);
    assert(typeof (await get("/admin/orders/status-counts", at)).PLACED === "number", "no PLACED count");
  });
  await step("admin finds the order", async () => {
    const list = await call("GET", `/admin/orders?q=${order.orderNumber}`, { token: at });
    assert(list.data.some((o) => o.id === order.id), "order not found by number");
    const data = await get(`/admin/orders/${order.id}`, at);
    hasKeys(data, ["allowedTransitions", "canAssignRider", "whatsappLinks", "notificationLogs"], "admin order detail");
  });
  await step("confirm → packed", async () => {
    await patch(`/admin/orders/${order.id}/status`, { status: "CONFIRMED" }, at);
    await patch(`/admin/orders/${order.id}/status`, { status: "PACKED", note: "Packed by smoke test" }, at);
  });
  await step("illegal transition is rejected", async () => {
    await call("PATCH", `/admin/orders/${order.id}/status`, { token: at, body: { status: "DELIVERED" }, expect: [409] });
  });
  const rider = await step("pick an active rider", async () => {
    const riders = await get("/admin/riders?active=true", at);
    if (riders.length) return riders[0];
    return post("/admin/riders", { name: "Smoke Rider", phone: `8${String(stamp).slice(-9)}`, vehicleType: "BIKE" }, at);
  });
  await step("assign rider", async () => {
    const data = await patch(`/admin/orders/${order.id}/assign-rider`, { riderId: rider.id }, at);
    assert(data?.status === "RIDER_ASSIGNED" || (await get(`/admin/orders/${order.id}`, at)).status === "RIDER_ASSIGNED", "status is not RIDER_ASSIGNED");
  });
  await step("customer sees the rider", async () => {
    const data = await get(`/orders/${order.id}`, token);
    hasKeys(data.rider, ["name", "phone", "whatsapp", "vehicleType"], "rider");
    assert(!data.actions.canCancel, "should not be cancellable once a rider is assigned");
  });
  await step("rider notifications were logged", async () => {
    // Sends run after commit in the background; give them a moment.
    for (let i = 0; i < 10; i++) {
      const logs = await get(`/admin/notification-logs?orderId=${order.id}`, at);
      if (logs.length) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("no notification log entries for the order");
  });
  await step("out for delivery → delivered", async () => {
    await patch(`/admin/orders/${order.id}/status`, { status: "OUT_FOR_DELIVERY" }, at);
    await patch(`/admin/orders/${order.id}/status`, { status: "DELIVERED" }, at);
  });

  console.log("\nCustomer: after delivery");
  await step("timeline complete, review + return allowed", async () => {
    const data = await get(`/orders/${order.id}`, token);
    assert(data.status === "DELIVERED", `status is ${data.status}`);
    assert(data.timeline.every((s) => s.at !== null), "timeline has pending steps");
    assert(data.items[0].canReview, "canReview is false");
    assert(data.actions.canReturn, "canReturn is false");
  });
  await step("coins credited on delivery", async () => {
    const coins = await get("/coins", token);
    assert(coins.balance === order.coinsToEarn, `balance ${coins.balance}, expected ${order.coinsToEarn}`);
  });
  await step("in-app notifications arrived", async () => {
    assert((await get("/notifications/unread-count", token)).count > 0, "no unread notifications");
    await post("/notifications/read-all", undefined, token);
  });
  await step("write a review", async () => {
    await post("/reviews", { productId: product.id, rating: 5, title: "Smoke test", comment: "Automated smoke test review" }, token);
    assert((await get(`/orders/${order.id}`, token)).items[0].canReview === false, "still reviewable after review");
  });
  await step("request return → admin approves", async () => {
    await post(`/orders/${order.id}/return`, { reason: "Smoke test return" }, token);
    await patch(`/admin/orders/${order.id}/status`, { status: "RETURNED" }, at);
    assert((await get(`/orders/${order.id}`, token)).status === "RETURNED", "not RETURNED");
  });

  console.log("\nCustomer: cancel flow");
  await step("buy now + cancel restores stock", async () => {
    const before = (await get(`/products/${product.slug}`)).variants.find((v) => v.id === variant.id).stock;
    const placed = await post("/orders", { addressId: address.id, paymentMethod: "UPI_ON_DELIVERY", items: [{ variantId: variant.id, quantity: 1 }] }, token);
    await post(`/orders/${placed.id}/cancel`, { reason: "Smoke test cancel" }, token);
    const data = await get(`/orders/${placed.id}`, token);
    assert(data.status === "CANCELLED", `status is ${data.status}`);
    const after = (await get(`/products/${product.slug}`)).variants.find((v) => v.id === variant.id).stock;
    assert(before === after, `stock ${before} → ${after} after cancel`);
  });
  await step("logout revokes the refresh token", async () => {
    const session = await post("/auth/login", { identifier: email, password });
    await call("POST", "/auth/logout", { body: { refreshToken: session.refreshToken } });
    await call("POST", "/auth/refresh", { body: { refreshToken: session.refreshToken }, expect: [401] });
  });

}

main()
  .catch((error) => failures.push(`crashed: ${error.stack ?? error}`))
  .finally(() => {
    console.log(`\n${passed} passed, ${failures.length} failed`);
    if (failures.length) {
      console.log(failures.map((f) => `  - ${f}`).join("\n"));
      process.exitCode = 1;
    }
  });
