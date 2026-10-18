# API Reference

- **Base URL:** `/api/v1`
- **Body format:** JSON. **Money is integer paise.**
- **Auth:** `Authorization: Bearer <accessToken>`. Access tokens live 15 min. Refresh with `POST /auth/refresh`.

**Success:**

```json
{ "data": ..., "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }
```

**Error:**

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Enter a valid email", "details": [{ "path": "email", "message": "..." }] } }
```

| Code | HTTP |
|---|---|
| `BAD_REQUEST` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT`, `OUT_OF_STOCK`, `INVALID_TRANSITION` | 409 |
| `VALIDATION_ERROR`, `COUPON_INVALID` | 422 |
| `RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 |

When the access token has expired, the `UNAUTHORIZED` response carries `details.reason = "TOKEN_EXPIRED"`.

**Access legend:** 🌐 public (guest OK; personalised when a token is sent) · 👤 customer token · 🏪 vendor token · 🛡 admin token

**List queries** accept `page` (default 1) and `limit` (default 20, max 100).

---

## Auth: `/auth`

| Method | Path | Access | Body / Notes |
|---|---|---|---|
| POST | `/register` | 🌐 | `{ name, email, phone, password, referralCode? }` → `{ user, accessToken, refreshToken }` |
| POST | `/login` | 🌐 | `{ identifier (email or phone), password }` → session |
| POST | `/refresh` | 🌐 | `{ refreshToken }` → new session. Tokens rotate on every refresh. Reusing an old token revokes all sessions, except within 10 s of its rotation: parallel requests racing to refresh then each get a fresh session. Logged-out tokens get no grace |
| POST | `/logout` | 🌐 | `{ refreshToken }` → 204 |
| GET | `/me` | 👤 | current user (includes `referralCode`) |
| POST | `/password/forgot` | 🌐 | `{ email }`: emails a 6-digit OTP (10 min) |
| POST | `/password/reset` | 🌐 | `{ email, otp, password }` |
| POST | `/password/change` | 👤 | `{ currentPassword, newPassword }` |

Passwords must be at least 8 characters and contain at least one letter and one number. Auth endpoints are rate-limited to 30 per 15 min per IP.

## Storefront (guest-browsable)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/home` | 🌐 | `{ banners: { carousel, strip }, categories, rails: [{ key, title, items, query }] }` |
| GET | `/settings` | 🌐 | public store settings (fees, thresholds, coin rules, referral bonuses, payment toggles) |
| GET | `/categories` | 🌐 | tree: top-level categories with `children` |
| GET | `/categories/:slug` | 🌐 | category with parent and children |
| GET | `/brands` | 🌐 | active brands |
| GET | `/products` | 🌐 | see listing query below |
| GET | `/products/facets` | 🌐 | `{ brands: [{ slug, name, count }], price: { min, max } }` for the same query |
| GET | `/products/suggestions?q=` | 🌐 | `{ products, categories, brands }` (typeahead) |
| GET | `/products/trending-searches` | 🌐 | `string[]` |
| GET | `/products/:slug` | 🌐 | detail: images, variants, rating breakdown, top reviews, offers, `isWishlisted` |
| GET | `/products/:slug/similar` | 🌐 | product cards |
| GET | `/banners?placement=` | 🌐 | live banners |
| GET | `/coupons` | 🌐 | public offers |
| GET | `/reviews?productId=&rating=&sort=` | 🌐 | `sort`: `recent` \| `rating_high` \| `rating_low` |

### Listing query (`GET /products`)

| Param | Example | Meaning |
|---|---|---|
| `q` | `shoes` | name / tag / brand / category search |
| `category` | `smartphones` | category slug (includes sub-categories) |
| `brand` | `apple,samsung` | comma-separated brand slugs |
| `minPrice`, `maxPrice` | `0`, `49900` | paise |
| `rating` | `4` | minimum average |
| `discount` | `30` | minimum % off |
| `inStock` | `true` | — |
| `featured` | `true` | — |
| `ids` | `id1,id2` | used for "recently viewed" |
| `sort` | `relevance` \| `popular` \| `price_asc` \| `price_desc` \| `newest` \| `discount` \| `rating` | — |

### Product card shape

```json
{ "id": "…", "slug": "…", "name": "…", "brand": "Apple", "imageUrl": "…",
  "price": 7999900, "mrp": 8999900, "discountPercent": 11,
  "ratingAvg": 4.3, "ratingCount": 128, "inStock": true,
  "defaultVariantId": "… (null when several variants)", "variantCount": 1, "isWishlisted": false }
```

## Customer

| Method | Path | Notes |
|---|---|---|
| PATCH | `/profile` | `{ name?, phone?, avatarUrl? }` |
| GET | `/profile/referrals` | `{ referralCode, completedCount, pendingCount, totalCoinsEarned, referrerBonus, refereeBonus, enabled }` |
| POST | `/profile/referrals` | `{ referralCode }`: applies referral code before first order |
| POST | `/uploads/avatar` | multipart `file` (JPEG/PNG/WebP, max 5 MB) → `{ url }` |
| GET/POST | `/addresses` | list / create `{ name, phone, line1, line2?, landmark?, city, state, pincode, type, isDefault }` |
| PATCH/DELETE | `/addresses/:id` | update / delete (the default moves to the next address) |
| POST | `/addresses/:id/default` | make default |
| GET | `/wishlist` | product cards |
| GET | `/wishlist/ids` | `string[]` of product IDs |
| PUT/DELETE | `/wishlist/:productId` | add / remove (204) |
| GET | `/cart?coupon=CODE&useCoins=true` | `{ items: CartLine[], summary: PriceSummary }` |
| GET | `/cart/count` | `{ count }` (badge) |
| GET | `/cart/coupons` | coupons with `applicable` / `reason` for the current cart |
| POST | `/cart/items` | `{ variantId, quantity }` (max 10 per line, stock-checked) |
| PATCH | `/cart/items/:id` | `{ quantity }` |
| DELETE | `/cart/items/:id` | remove line |
| POST | `/cart/items/:id/save-for-later` | moves to wishlist |
| DELETE | `/cart` | clear |
| POST | `/orders/quote` | `{ couponCode?, useCoins?, items? }`: checkout preview (cart or buy-now items) |
| POST | `/orders` | `{ addressId, paymentMethod: COD \| UPI_ON_DELIVERY, couponCode?, useCoins?, items?, note? }` → `{ id, orderNumber, payable, coinsToEarn }` |
| GET | `/orders?status=active\|delivered\|cancelled\|returns` | order summaries |
| GET | `/orders/:id` | detail: items (`canReview`), `timeline`, `history`, `rider { name, phone, whatsapp }`, `actions { canCancel, canReturn }` |
| POST | `/orders/:id/cancel` | `{ reason }`. Allowed in PLACED / CONFIRMED / PACKED |
| POST | `/orders/:id/return` | `{ reason }`. Only for DELIVERED orders within the return window |
| GET | `/coins` | `{ balance, lifetimeEarned, pending, history }` |
| GET | `/reviews/mine` | — |
| POST | `/reviews` | `{ productId, rating 1-5, title?, comment? }`. Requires a delivered purchase. Upserts |
| DELETE | `/reviews/:id` | own review |
| GET | `/notifications` | in-app notifications |
| GET | `/notifications/unread-count` | `{ count }` |
| POST | `/notifications/:id/read`, `/notifications/read-all` | — |

### PriceSummary

```json
{ "itemCount": 2, "itemsMrp": 80000, "itemsTotal": 60000, "mrpDiscount": 20000,
  "couponCode": "SAVE10", "couponDiscount": 5000, "couponError": null,
  "coinsAvailable": 120, "coinsRedeemable": 110, "coinsUsed": 110, "coinsDiscount": 11000,
  "deliveryFee": 0, "amountForFreeDelivery": 0, "payable": 44000,
  "totalSavings": 36000, "coinsToEarn": 8 }
```

## Admin: `/admin` 🛡

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard?days=30` | KPIs with % change, daily series, status breakdown, top products, recent orders |
| GET/POST | `/products` | list (`q`, `categoryId`, `brandId`, `status=active\|inactive\|low_stock\|out_of_stock`) / create |
| GET/PATCH/DELETE | `/products/:id` | detail / update (variants upserted; stock **not** editable here) / delete (archives if ordered) |
| GET/POST | `/categories` | flat list with counts / create `{ name, parentId?, imageUrl?, sortOrder, isActive }` |
| PATCH/DELETE | `/categories/:id` | delete blocked while it has products or children |
| GET/POST, PATCH/DELETE | `/brands`, `/brands/:id` | — |
| GET | `/inventory?vendorId=&branchId=&categoryId=&status=all\|in\|low\|out&sort=name\|stock&q=` | **read-only** shop stock (no cost prices); stock belongs to vendors. `sort` defaults to `name`; `stock` lists lowest first. A parent `categoryId` includes its sub-categories |
| GET | `/inventory/summary?vendorId=&branchId=` | `{ lowStock, outOfStock, totalUnits, stockValue }` |
| GET | `/inventory/listings/:id/movements` | stock log of one listing |
| GET | `/orders?q=&status=&riderId=&vendorId=&branchId=&from=&to=` | includes `vendor`, `branch` |
| GET | `/orders/status-counts?vendorId=` | `{ PLACED: 3, … }`, optionally for one shop |
| GET | `/orders/:id` | detail plus `allowedTransitions`, `canAssignRider`, `whatsappLinks`, `notificationLogs` |
| PATCH | `/orders/:id/status` | `{ status, note? }`. Validated by the state machine |
| PATCH | `/orders/:id/assign-rider` | `{ riderId, note? }`. Emails and WhatsApps the customer, rider and admin |
| POST | `/orders/:id/resend-notifications` | resends the rider-assignment messages (awaited) |
| PATCH | `/orders/:id/note` | `{ adminNote }` |
| GET/POST | `/riders` | list (`q`, `active`, `vendorId`) with `activeOrders` / create (`vendorId` sets the shop) |
| POST | `/riders/:id/link` | new private schedule link token |
| GET/PATCH/DELETE | `/riders/:id` | detail with recent orders and stats / update / delete (deactivates if they have history) |
| GET | `/customers?q=&blocked=` | with `orderCount` and `totalSpent` |
| GET | `/customers/:id` | addresses, orders, coin history, stats |
| PATCH | `/customers/:id/block` | `{ isBlocked }`. Blocking revokes sessions |
| POST | `/customers/:id/coins` | `{ amount (±), note }` |
| GET/POST | `/coupons` | list (`q`, `status=active\|inactive\|expired`) / create |
| GET/PATCH/DELETE | `/coupons/:id` | detail with redemptions / update / delete (archives if used) |
| GET/POST, PATCH/DELETE | `/banners`, `/banners/:id` | — |
| GET | `/reviews?q=&rating=&hidden=` | — |
| PATCH/DELETE | `/reviews/:id` | `{ isHidden }` / delete. Ratings are recomputed |
| GET/PATCH | `/settings` | store settings (fees, delivery threshold, coin earning/redeeming, referral program rules, payment methods) |
| GET | `/notification-logs?status=&channel=&orderId=` | email/WhatsApp delivery log |
| POST | `/uploads` | multipart `file` → `{ url, key }` |


---

## Marketplace (vendors, shops, subscriptions, support)

Design and rules: [MARKETPLACE.md](MARKETPLACE.md). Location-aware endpoints read the shopper's point from the **`X-Location: <lat>,<lng>`** header (or `?lat=&lng=`); without it, prices come from the cheapest shop and fees show each shop's minimum.

### Shape changes to existing endpoints

- **Product card** gains `shop { vendorName, vendorSlug, distanceKm, isOpen, label }` and `shopCount`. `price`/`mrp`/`inStock` come from the best shop for the shopper. Only items an approved shop lists are browsable. `GET /products?vendor=<slug>` gives one shop's items at its own prices.
- **Product detail**: each variant has `offers[]` (every shop selling it, ranked: available, then closed, out of stock, too far; nearest first) and `price`/`mrp`/`stock` of the default offer.
- **Offer**: `{ listingId, variantId, price, mrp, discountPercent, inStock, stockLeft (≤5 only), label: AVAILABLE|CLOSED|OUT_OF_STOCK|TOO_FAR, shop }`.
- **Shop** (`shop` objects everywhere): `{ branchId, branchName, vendorId, vendorSlug, vendorName, logoUrl, isOpen, statusMessage, distanceKm, deliveryFee, freeDeliveryAbove, deliverable }`.
- **Cart**: `GET /cart` returns `{ shop, items, summary, deliverable }`. Lines carry `listingId`. `POST /cart/items` takes `{ variantId, quantity, branchId?, replaceCart? }`: without `branchId` the best shop for the location is used. Adding from another shop returns **409 `CART_SHOP_CONFLICT`** with `details { cartShop, newShop }`; resend with `replaceCart: true` to start a new cart.
- **Checkout**: `POST /orders/quote` and `POST /orders` accept `branchId` for "buy now" items; the quote also takes `addressId`. Delivery fee = `max(minDeliveryFee, distanceKm × deliveryRatePerKm)`, free at the shop's `freeDeliveryAbove`. Placing fails with **409 `SHOP_UNAVAILABLE`** when the shop is closed or too far.
- **Addresses** accept `lat` / `lng` (from GPS or the map pin).
- **Home** adds `dailyEssentials` (subscription plans that deliver here) and `shops` (nearby shops).
- **Session user** adds `vendorId`, `vendorRole` (`OWNER` | `STAFF`) and `isSuperAdmin`.

### Public and customer

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/vendors/signup` | 🌐 | `{ owner { name, email, phone, password }, shop { shopName, phone, email, address, … }, branch { name, address, city, state, pincode, lat, lng, … } }` → vendor `PENDING` |
| GET | `/vendors/:slug` | 🌐 | shop page: branches with status and distance, listing count, plan count |
| GET | `/branches/nearby?limit=` | 🌐 | shops that deliver to the point, open first |
| GET | `/offers?variantId=` | 🌐 | every shop selling a variant, ranked |
| GET | `/cart/shops` | 👤 | other shops that can fill the cart: `availableItems`, `itemsTotal`, fee, distance |
| POST | `/cart/shop` | 👤 | `{ branchId }` moves the cart to another shop |
| GET | `/plans?q=&vendor=` | 🌐 | daily essentials (subscription plans), deliverable first |
| GET | `/plans/:id` | 🌐 | plan with `prices[]` per period, product, shop |
| POST | `/subscriptions/quote` | 👤 | `{ planId, period, startDate, weekdays (Mon=1…Sun=64), quantity, slot?, skipDates[], paymentPlan, addressId? }` → every date, `breakdown { deliveries, goodsTotal, deliveryTotal, total }`, `instalments[]` |
| POST | `/subscriptions` | 👤 | same body + `addressId` → subscription with its schedule |
| GET | `/subscriptions`, `/subscriptions/:id` | 👤 | list with `nextDelivery` / detail with `deliveries[]`, `pauses[]`, `payments[]`, `ledger { charged, paid, balance, expectedTotal, dueNow, instalments[] }` |
| POST | `/subscriptions/:id/skip` | 👤 | `{ date, skip }`. Until 20:00 IST the evening before |
| POST / DELETE | `/subscriptions/:id/pauses`, `/subscriptions/:id/pauses/:pauseId` | 👤 | pause `{ fromDate, toDate }` (skips those drops) / undo |
| POST | `/subscriptions/:id/cancel`, `/subscriptions/:id/renew` | 👤 | cancel `{ reason }` (future drops cancelled) / renew with the same settings |
| POST | `/tickets` | 👤 | `{ category, subject, message, orderId?, subscriptionId? }`. `ORDER_ISSUE` and `SUBSCRIPTION_ISSUE` go to the shop (MINOR); others to the platform (MAJOR) |
| GET | `/tickets`, `/tickets/counts`, `/tickets/:id` | 👤 | own tickets and thread |
| POST / PATCH | `/tickets/:id/messages`, `/tickets/:id/status` | 👤 | reply (reopens a resolved ticket) / close |
| POST | `/chat/vendors/:vendorId` | 👤 | open the conversation with a shop |
| GET | `/chat`, `/chat/unread`, `/chat/:id/messages?after=` | 👤 | conversations / unread total / messages (poll with `after`) |
| POST | `/chat/:id/messages`, `/chat/:id/read` | 👤 | `{ body, orderId? }` / mark read |
| GET | `/documents/:kind/:id` | 👤 🏪 🛡 | PDF download. `kind`: `invoice` (order), `statement` (subscription), `receipt` (payment), `payout`, `bill` (counter sale) |
| POST | `/documents/:kind/:id/link` | 👤 🏪 🛡 | `{ url, expiresInSeconds }`: a 15-minute link the app opens in the browser |
| GET | `/documents/download?t=` | link | the PDF behind a signed link |
| GET | `/rider-schedule/:token?date=` | rider link | the rider's day: subscription drops, open orders, the month ahead |
| POST | `/rider-schedule/:token/deliveries/:id/delivered` | rider link | marks a drop delivered (stock deducted) |
| GET / POST | `/cron/daily` | `Authorization: Bearer <CRON_SECRET>` | reminders for tomorrow, stock warnings, instalment reminders, completes finished subscriptions |

### Vendor portal: `/vendor` 🏪

All routes are scoped to the caller's shop. Suspended or rejected shops are read-only.

| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/profile` | shop profile (`subscriptionsEnabled` turns on daily needs) |
| GET | `/profile/dashboard?days=` | today's to-dos, period sales and earnings, stock, unread chats, open tickets, series |
| GET / POST / DELETE | `/staff`, `/staff/:id` | staff logins (owner only) |
| GET / POST / PATCH | `/branches`, `/branches/:id` | location, hours (`opensAt`/`closesAt`), radius, `deliveryRatePerKm`, `minDeliveryFee`, `freeDeliveryAbove` |
| PATCH | `/branches/:id/online` | `{ isOnline, reason?, offlineMessage? }` |
| GET | `/listings?branchId=&categoryId=&status=&sort=name\|stock&q=` | own stock with cost prices |
| GET | `/listings/summary`, `/listings/catalog?q=&branchId=` | stock summary / catalog search to list existing products |
| POST / PATCH / DELETE | `/listings`, `/listings/:id` | `{ branchId, variantId, price, mrp, costPrice?, stock, lowStockThreshold, isAvailable }` |
| POST | `/listings/:id/adjust` | `{ mode: IN \| OUT \| SET, quantity, reason }` (manual change, logged) |
| GET | `/listings/:id/movements` | every change: SALE, CANCEL, RETURN, SUBSCRIPTION, COUNTER_SALE, IN, OUT, SET |
| POST / GET / PATCH | `/products`, `/products/:id` | products the shop creates (variants are listed at a branch in the same step) |
| GET … | `/orders`, `/orders/status-counts`, `/orders/:id` | same shape as the admin endpoints |
| PATCH | `/orders/:id/status`, `/orders/:id/assign-rider` | own riders only |
| CRUD | `/riders`, `/riders/:id`; POST `/riders/:id/link` | own delivery partners |
| GET / POST | `/counter-sales`, `/counter-sales/:id` | in-shop bills; stock leaves like an online order |
| GET / POST | `/messages…` | the chat endpoints from the shop's side |
| GET / POST / PATCH / DELETE | `/plans`, `/plans/:id` | `{ listingId, name, quantityPerDelivery, slots[], capacity?, prices: [{ period, pricePerDelivery, deliveryFee, deliveryFeeMode: PER_DELIVERY \| PER_PERIOD }] }` |
| GET | `/subscriptions`, `/subscriptions/:id` | subscribers with balance / detail with ledger |
| POST | `/subscriptions/:id/payments` | `{ amount (negative = refund), method, note? }` → receipt `RCPT-…`, customer emailed |
| PATCH | `/subscriptions/:id/rider` | `{ riderId \| null }` (sends the rider the schedule link) |
| GET | `/deliveries?date=&branchId=` | the day's drops, per-product loading totals |
| POST | `/deliveries/delivered` | `{ ids[] }` "today's delivery sent": deducts stock per drop |
| POST | `/deliveries/:id/missed`, `/deliveries/riders/:id/send-link` | `{ note }` / email the schedule link, returns a WhatsApp link |
| GET … | `/tickets…` | minor tickets about the shop, with customer and order context |
| GET | `/payouts`, `/payouts/upcoming?from=&to=`, `/payouts/:id` | settlements |
| GET | `/reports/export?preset=this_week\|this_month\|last_month\|custom&from=&to=` | `.xlsx`: summary, sales and profit, best sellers, inventory, subscriptions, settlements |
| POST | `/uploads` | product photos, logo, ID proof (image) |

### Admin additions: `/admin` 🛡

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/vendors` | list (`q`, `status`) / create an approved vendor with owner login and first branch |
| GET / PATCH | `/vendors/:id` | detail with branches, members, stats / update (incl. `commissionBps`) |
| POST | `/vendors/:id/status` | `{ action: approve \| reject \| suspend \| reactivate, reason? }` (reason required for reject/suspend) |
| GET | `/branches` | every shop, read-only |
| GET … | `/tickets…`; PATCH `/tickets/:id/level` | all tickets with context / `{ level }` escalate or hand to the shop |
| GET / POST | `/payouts`; GET `/payouts/preview/:vendorId?from=&to=`; POST `/payouts/:id/paid` | settlements; `netAmount` > 0 the platform pays the vendor, < 0 the vendor pays the platform |
| GET | `/reports/platform`, `/reports/vendors/:id` | `.xlsx` workbooks (same presets) |
| GET | `/audit?vendorId=&actorId=&entity=&from=&to=` | **super admin**: who did what |
| GET / POST / DELETE | `/admins`, `/admins/:id`; POST `/admins/:id/restore` | **super admin**: admin accounts |

Error codes added: `CART_SHOP_CONFLICT` (409), `SHOP_UNAVAILABLE` (409).

**Date filters** (`from` / `to` on orders, counter sales, payouts, reports and the audit log) accept a calendar day such as `2026-10-18`, meaning that whole day in IST (`to` is inclusive), or a full ISO timestamp.
