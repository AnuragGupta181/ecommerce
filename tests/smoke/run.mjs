#!/usr/bin/env node
/**
 * End-to-end smoke test against a running API (seeded database).
 * Plays guest → customer → vendor → admin → customer through the marketplace order lifecycle
 * and checks the response fields the mobile app and portal read.
 *
 *   node --env-file=backend/.env tests/smoke/run.mjs
 *
 * Env: API_URL (default http://localhost:4000/api/v1), ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD,
 * TEST_ACCOUNT_PASSWORD (defaults to the documented test password; see docs/TEST_ACCOUNTS.md).
 * It creates a throwaway customer (smoke+<timestamp>@haat.test) and two orders; run it on a dev database.
 */

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? "admin@haat.local";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
const VENDOR_PASSWORD = process.env.TEST_ACCOUNT_PASSWORD ?? "Haat@Test123";
/** Hebbal, Bengaluru: right next to the seeded "Sharma Dairy & Kirana" shop. */
const HERE = "13.0352,77.5975";

let passed = 0;
const failures = [];

async function call(method, path, { token, body, expect = [200, 201, 204], location = HERE } = {}) {
  const res = await fetch(`${API}${path}`, {
    signal: AbortSignal.timeout(30_000),
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(location ? { "X-Location": location } : {}),
    },
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

const CARD_KEYS = ["id", "slug", "name", "brand", "imageUrl", "price", "mrp", "discountPercent", "ratingAvg", "ratingCount", "inStock", "defaultVariantId", "isWishlisted", "shop", "shopCount"];
const SUMMARY_KEYS = ["itemCount", "itemsMrp", "mrpDiscount", "couponCode", "couponDiscount", "couponError", "coinsAvailable", "coinsRedeemable", "coinsUsed", "coinsDiscount", "deliveryFee", "amountForFreeDelivery", "payable", "totalSavings", "coinsToEarn"];
const SHOP_KEYS = ["branchId", "branchName", "vendorId", "vendorSlug", "vendorName", "isOpen", "statusMessage", "distanceKm", "deliveryFee", "deliverable"];

async function login(identifier, password) {
  return post("/auth/login", { identifier, password });
}

async function main() {
  console.log(`Smoke test against ${API} (browsing from ${HERE})\n`);
  await step("API is up", async () => assert((await call("GET", "/health")) !== null, "no health response"));

  console.log("\nGuest browsing");
  await step("home feed", async () => {
    const data = await get("/home");
    hasKeys(data, ["banners", "categories", "rails"], "home");
    assert(data.rails.length > 0, "no rails");
    if (data.rails[0].items[0]) hasKeys(data.rails[0].items[0], CARD_KEYS, "product card");
  });
  await step("shops near me", async () => {
    const shops = await get("/branches/nearby");
    assert(shops.length > 0, "no shops nearby");
    hasKeys(shops[0], SHOP_KEYS, "shop");
    assert(shops[0].distanceKm !== null, "distance not computed");
  });
  // Milk is sold by both the platform shop and Sharma Dairy: the nearest open shop must win.
  const product = await step("product sold by several shops", async () => {
    const page = await call("GET", "/products?q=milk&inStock=true&limit=20");
    const card = page.data.find((p) => p.slug === "milk") ?? page.data.find((p) => p.shopCount > 1 && p.defaultVariantId);
    assert(card, "no product sold by several shops");
    hasKeys(card, CARD_KEYS, "product card");
    assert(card.shopCount > 1, `expected several shops, got ${card.shopCount}`);
    return card;
  });
  if (!product) return;
  const detail = await step("product detail lists every shop's offer", async () => {
    const data = await get(`/products/${product.slug}`);
    hasKeys(data, ["images", "variants", "rating", "topReviews", "offers", "category", "isWishlisted"], "product detail");
    const variant = data.variants.find((v) => v.inStock);
    hasKeys(variant, ["id", "label", "price", "mrp", "inStock", "stock", "offers"], "variant");
    assert(variant.offers.length > 1, "expected several offers");
    hasKeys(variant.offers[0], ["listingId", "price", "mrp", "inStock", "stockLeft", "label", "shop"], "offer");
    hasKeys(variant.offers[0].shop, SHOP_KEYS, "offer.shop");
    return { data, variant };
  });
  if (!detail) return;
  const [nearest, farther] = detail.variant.offers;
  await step("nearest available shop is the default", async () => {
    assert(nearest.label === "AVAILABLE", `first offer is ${nearest.label}`);
    if (farther.label === "AVAILABLE") assert(nearest.shop.distanceKm <= farther.shop.distanceKm, "offers not sorted by distance");
  });
  await step("offers endpoint matches", async () => {
    const offers = await get(`/offers?variantId=${detail.variant.id}`);
    assert(offers[0].listingId === nearest.listingId, "different default offer");
  });
  await step("shop page", async () => {
    const shop = await get(`/vendors/${nearest.shop.vendorSlug}`);
    hasKeys(shop, ["shopName", "branches", "listingCount", "subscriptionsEnabled"], "shop page");
    const page = await call("GET", `/products?vendor=${nearest.shop.vendorSlug}&limit=5`);
    assert(page.data.length > 0, "shop has no products");
  });
  await step("guest cannot reach the cart", async () => {
    await call("GET", "/cart", { expect: [401] });
  });

  console.log("\nCustomer: account and cart");
  const stamp = Date.now();
  const email = `smoke+${stamp}@haat.test`;
  const password = "Smoke-test-1234";
  const phone = `9${String(stamp).slice(-9)}`;
  await step("register", async () => hasKeys(await post("/auth/register", { name: "Smoke Tester", email, phone, password }), ["user", "accessToken", "refreshToken"], "session"));
  const customer = await step("login by phone", async () => login(phone, password));
  if (!customer) return;
  let token = customer.accessToken;
  await step("refresh rotates the session", async () => {
    const next = await post("/auth/refresh", { refreshToken: customer.refreshToken });
    assert(next.refreshToken !== customer.refreshToken, "refresh token did not rotate");
    token = next.accessToken;
  });
  const [lat, lng] = HERE.split(",").map(Number);
  const address = await step("add address with coordinates", async () =>
    post("/addresses", { name: "Smoke Tester", phone, line1: "12 Test Street", city: "Bengaluru", state: "Karnataka", pincode: "560024", type: "HOME", isDefault: true, lat, lng }, token),
  );
  await step("wishlist toggle shows the heart", async () => {
    await put(`/wishlist/${product.id}`, token);
    assert((await get(`/products/${product.slug}`, token)).isWishlisted === true, "isWishlisted not set");
  });

  await step("add to cart picks the nearest shop", async () => {
    await post("/cart/items", { variantId: detail.variant.id, quantity: 2 }, token);
    const cart = await get("/cart", token);
    hasKeys(cart, ["shop", "items", "summary", "deliverable"], "cart");
    assert(cart.shop.branchId === nearest.shop.branchId, `cart went to ${cart.shop.vendorName}`);
  });
  if (farther) {
    await step("item from another shop is a conflict", async () => {
      const res = await call("POST", "/cart/items", { token, body: { variantId: detail.variant.id, quantity: 1, branchId: farther.shop.branchId }, expect: [409] });
      assert(res.error.code === "CART_SHOP_CONFLICT", `got ${res.error.code}`);
      hasKeys(res.error.details, ["cartShop", "newShop"], "conflict details");
    });
    await step("other shops that can fill the cart", async () => {
      const shops = await get("/cart/shops", token);
      assert(shops.some((shop) => shop.isCurrent), "current shop missing");
      hasKeys(shops[0], [...SHOP_KEYS, "availableItems", "totalItems", "itemsTotal"], "shop option");
    });
  }
  await step("cart price summary is distance-based", async () => {
    const data = await get("/cart", token);
    hasKeys(data.items[0], ["id", "listingId", "quantity", "maxQuantity", "available", "lineMrp", "lineTotal", "variant", "product"], "cart line");
    hasKeys(data.summary, SUMMARY_KEYS, "price summary");
    assert(data.summary.payable === data.summary.itemsTotal - data.summary.couponDiscount - data.summary.coinsDiscount + data.summary.deliveryFee, "payable does not add up");
    assert(data.items[0].variant.price === nearest.price, "cart price is not the shop's price");
  });
  const coupon = await step("cart coupons + apply one", async () => {
    const usable = (await get("/cart/coupons", token)).find((c) => c.applicable);
    if (!usable) return undefined;
    const priced = await get(`/cart?coupon=${usable.code}`, token);
    assert(priced.summary.couponError === null, `coupon ${usable.code}: ${priced.summary.couponError}`);
    return usable.code;
  });
  const quote = await step("checkout quote for the address", async () => {
    const data = await post("/orders/quote", { couponCode: coupon, addressId: address.id }, token);
    hasKeys(data, ["shop", "items", "summary", "deliverable"], "quote");
    assert(data.deliverable, "address not deliverable");
    return data;
  });

  console.log("\nCustomer: place order");
  const order = await step("place COD order", async () => {
    const placed = await post("/orders", { addressId: address.id, paymentMethod: "COD", couponCode: coupon, note: "Smoke test" }, token);
    hasKeys(placed, ["id", "orderNumber", "payable", "coinsToEarn"], "placed order");
    assert(placed.payable === quote.summary.payable, `order payable ${placed.payable} ≠ quote ${quote.summary.payable}`);
    return placed;
  });
  if (!order) return;
  await step("cart is empty after ordering", async () => assert((await get("/cart/count", token)).count === 0, "cart not cleared"));
  await step("order detail before dispatch", async () => {
    const data = await get(`/orders/${order.id}`, token);
    hasKeys(data, ["timeline", "history", "rider", "actions", "shippingAddress", "items"], "order detail");
    assert(data.status === "PLACED" && data.actions.canCancel, "expected PLACED and cancellable");
  });

  console.log("\nVendor: fulfil the order");
  if (!VENDOR_PASSWORD || nearest.shop.vendorSlug !== "sharma-dairy") {
    failures.push("vendor steps need the seeded Sharma Dairy shop nearest to the test point");
    return;
  }
  const vendor = await step("vendor login", async () => {
    const session = await login("vendor.sharma@haat.local", VENDOR_PASSWORD);
    assert(session.user.role === "VENDOR" && session.user.vendorId, "not a vendor login");
    return session;
  });
  if (!vendor) return;
  const vt = vendor.accessToken;
  await step("vendor sees the order and the chat message", async () => {
    const list = await call("GET", `/vendor/orders?q=${order.orderNumber}`, { token: vt });
    assert(list.data.some((o) => o.id === order.id), "order missing from vendor list");
    const threads = await call("GET", "/vendor/messages", { token: vt });
    assert(threads.data.some((t) => t.lastMessage.includes(order.orderNumber)), "no order message in vendor inbox");
  });
  await step("vendor stock was reduced for the sale", async () => {
    const listings = await call("GET", `/vendor/listings?q=${encodeURIComponent(product.name)}`, { token: vt });
    const row = listings.data.find((l) => l.id === nearest.listingId);
    assert(row, "listing not found");
    hasKeys(row, ["price", "costPrice", "stock", "status"], "vendor listing");
    const moves = await call("GET", `/vendor/listings/${row.id}/movements`, { token: vt });
    assert(moves.data.some((m) => m.type === "SALE" && m.orderId === order.id), "no SALE movement for the order");
  });
  await step("vendor cannot see another shop's stock", async () => {
    if (!farther) return;
    await call("GET", `/vendor/listings/${farther.listingId}/movements`, { token: vt, expect: [404] });
  });
  await step("confirm → packed", async () => {
    await patch(`/vendor/orders/${order.id}/status`, { status: "CONFIRMED" }, vt);
    await patch(`/vendor/orders/${order.id}/status`, { status: "PACKED", note: "Packed by smoke test" }, vt);
  });
  await step("illegal transition is rejected", async () => {
    await call("PATCH", `/vendor/orders/${order.id}/status`, { token: vt, body: { status: "DELIVERED" }, expect: [409] });
  });
  const rider = await step("vendor's own rider", async () => {
    const riders = await call("GET", "/vendor/riders?active=true", { token: vt });
    assert(riders.data.length > 0, "vendor has no riders");
    return riders.data[0];
  });
  await step("assign rider", async () => {
    const data = await patch(`/vendor/orders/${order.id}/assign-rider`, { riderId: rider.id }, vt);
    assert(data.status === "RIDER_ASSIGNED", `status is ${data.status}`);
  });
  await step("customer sees the rider", async () => {
    const data = await get(`/orders/${order.id}`, token);
    hasKeys(data.rider, ["name", "phone", "whatsapp", "vehicleType"], "rider");
    assert(!data.actions.canCancel, "should not be cancellable once a rider is assigned");
  });
  await step("out for delivery → delivered", async () => {
    await patch(`/vendor/orders/${order.id}/status`, { status: "OUT_FOR_DELIVERY" }, vt);
    await patch(`/vendor/orders/${order.id}/status`, { status: "DELIVERED" }, vt);
  });
  await step("counter bill reduces stock", async () => {
    const before = (await call("GET", `/vendor/listings?q=${encodeURIComponent(product.name)}`, { token: vt })).data.find((l) => l.id === nearest.listingId).stock;
    const bill = await post("/vendor/counter-sales", { branchId: nearest.shop.branchId, items: [{ listingId: nearest.listingId, quantity: 1 }], method: "CASH" }, vt);
    assert(bill.number.startsWith("BILL-"), "no bill number");
    const after = (await call("GET", `/vendor/listings?q=${encodeURIComponent(product.name)}`, { token: vt })).data.find((l) => l.id === nearest.listingId).stock;
    assert(after === before - 1, `stock ${before} → ${after}`);
  });

  console.log("\nAdmin");
  if (!ADMIN_PASSWORD) {
    failures.push("ADMIN_SEED_PASSWORD is not set; skipped admin steps");
    return;
  }
  const admin = await step("admin login", async () => {
    const session = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    assert(session.user.role === "ADMIN", "not an admin");
    return session;
  });
  if (!admin) return;
  const at = admin.accessToken;
  await step("role guards", async () => {
    await call("GET", "/admin/dashboard", { token, expect: [403] });
    await call("GET", "/admin/dashboard", { token: vt, expect: [403] });
    await call("GET", "/vendor/orders", { token: at, expect: [403] });
  });
  await step("dashboard + vendors", async () => {
    await get("/admin/dashboard?days=30", at);
    const vendors = await call("GET", "/admin/vendors", { token: at });
    assert(vendors.data.some((v) => v.status === "PENDING"), "no pending vendor in the list");
  });
  await step("admin sees the order with its shop and commission", async () => {
    const data = await get(`/admin/orders/${order.id}`, at);
    hasKeys(data, ["vendor", "branch", "commissionAmount", "vendorEarning", "invoiceNumber"], "admin order detail");
    assert(data.vendor.id === vendor.user.vendorId, "wrong vendor on order");
  });
  await step("admin inventory is read-only by vendor", async () => {
    const rows = await call("GET", `/admin/inventory?vendorId=${vendor.user.vendorId}&limit=5`, { token: at });
    assert(rows.data.length > 0, "no listings");
    assert(rows.data[0].costPrice === undefined, "admin must not see vendor cost prices");
    await call("POST", `/vendor/listings/${rows.data[0].id}/adjust`, { token: at, body: { mode: "IN", quantity: 1, reason: "x" }, expect: [403] });
  });
  await step("rider notifications were logged", async () => {
    for (let i = 0; i < 10; i++) {
      if ((await get(`/admin/notification-logs?orderId=${order.id}`, at)).length) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("no notification log entries for the order");
  });

  console.log("\nCustomer: after delivery");
  await step("timeline complete, review + return allowed", async () => {
    const data = await get(`/orders/${order.id}`, token);
    assert(data.status === "DELIVERED", `status is ${data.status}`);
    assert(data.items[0].canReview && data.actions.canReturn, "review/return not offered");
  });
  await step("coins credited on delivery", async () => {
    const coins = await get("/coins", token);
    assert(coins.balance === order.coinsToEarn, `balance ${coins.balance}, expected ${order.coinsToEarn}`);
  });
  await step("customer ↔ vendor chat", async () => {
    const threads = await call("GET", "/chat", { token });
    const thread = threads.data.find((t) => t.vendor.id === vendor.user.vendorId);
    assert(thread, "no conversation with the shop");
    await post(`/chat/${thread.id}/messages`, { body: "Thanks, milk was fresh!" }, token);
    const vendorView = await get(`/vendor/messages/${thread.id}/messages`, vt);
    assert(vendorView.messages.some((m) => m.body === "Thanks, milk was fresh!"), "vendor did not get the message");
  });
  await step("write a review", async () => {
    await post("/reviews", { productId: product.id, rating: 5, title: "Smoke test", comment: "Automated smoke test review" }, token);
  });
  await step("request return → vendor approves", async () => {
    await post(`/orders/${order.id}/return`, { reason: "Smoke test return" }, token);
    await patch(`/vendor/orders/${order.id}/status`, { status: "RETURNED" }, vt);
    assert((await get(`/orders/${order.id}`, token)).status === "RETURNED", "not RETURNED");
  });

  console.log("\nCustomer: cancel flow");
  await step("buy now + cancel restores shop stock", async () => {
    const stockOf = async () => (await call("GET", `/vendor/listings?q=${encodeURIComponent(product.name)}`, { token: vt })).data.find((l) => l.id === nearest.listingId).stock;
    const before = await stockOf();
    const placed = await post("/orders", { addressId: address.id, paymentMethod: "UPI_ON_DELIVERY", items: [{ variantId: detail.variant.id, quantity: 1 }], branchId: nearest.shop.branchId }, token);
    assert((await stockOf()) === before - 1, "buy now did not take stock");
    await post(`/orders/${placed.id}/cancel`, { reason: "Smoke test cancel" }, token);
    assert((await stockOf()) === before, "cancel did not restore stock");
  });
  await step("logout revokes the refresh token", async () => {
    const session = await login(email, password);
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
