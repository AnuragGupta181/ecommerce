# Marketplace: vendors, local delivery, subscriptions, support

> Design for turning Haat from a single store into a local marketplace. This is the source of truth for the vendor work; [PLAN.md](PLAN.md) tracks progress (Phases 8–14).
> It supersedes the earlier [branch_management_plan.md](branch_management_plan.md); the branch tables from that plan are kept and reused here.

## 1. Roles

| Role | Where | Can |
|---|---|---|
| `CUSTOMER` | Mobile app | Shop, subscribe, chat with vendors, raise tickets |
| `VENDOR` | Next.js portal (`/vendor/...`) | Run one shop: listings, stock, orders, riders, subscription plans, deliveries, payments, tickets, chat, reports |
| `ADMIN` | Next.js portal (existing pages + vendors, payouts, tickets, reports) | Approve vendors, set commission, see all orders, tickets and inventory (read-only), settle payouts, pull platform and per-vendor reports |
| Super admin (`ADMIN` + `isSuperAdmin`) | same portal | Everything an admin can do, plus create and remove admin accounts and read the audit log (who did what) |

- A `VENDOR` user belongs to exactly one vendor (`User.vendorId`). The vendor owner can add staff logins for the same shop.
- A vendor account is created either by the admin (approved straight away) or by the vendor signing up at `/vendor/signup` (starts `PENDING`).
- One login page serves admin and vendor; the session cookie carries the role and the portal shows the matching navigation.
- **Inventory belongs to vendors.** The admin can view any vendor's stock (pick vendor, then branch) but cannot change it. Every stock change is made by the vendor or by the system.
- **Audit log:** vendor approvals, commission changes, stock adjustments, order status changes, payouts and admin account changes are recorded with actor, time and before/after data.

## 2. Vendor and shop

```
Vendor (business: approval, commission, payouts, staff)
  └── Branch (the shop: location, hours, online switch, delivery pricing, stock, riders)
```

- Every vendor gets one branch when it is created; a vendor with several shops can add more. Customers see **"Shop name · Branch name"**.
- **Approval:** `PENDING → APPROVED`, or `REJECTED` (with a reason), and an approved vendor can be `SUSPENDED`. Only `APPROVED` vendors appear to customers.
- **Shop status:**
  - **Open:** online and inside opening hours.
  - **Closed:** outside opening hours, or switched offline by the vendor (with an optional message such as "Back at 9 am").
  - Closed shops stay visible, labelled "Closed", and their shop page can be opened, but they cannot take orders.

## 3. Catalog, listings and stock

- **Products stay a shared catalog.** "Amul Taaza 1 L" exists once; several vendors can sell it.
  - Vendors can create new products. The admin can edit or deactivate any product.
- **A listing** is one branch selling one product variant (the `BranchVariantStock` table, extended). It has:
  - the vendor's own `price` and `mrp`
  - `costPrice`, which is private and used for profit reports
  - `stock`, `lowStockThreshold` and `isAvailable`
- `ProductVariant.price/mrp/stock` remain as catalog reference values and fallbacks. Customer prices always come from a listing.

**Inventory, automatic and manual:**

| Event | Stock change | Movement type |
|---|---|---|
| Order placed | − quantity | `SALE` |
| Order cancelled or returned | + quantity | `CANCEL` / `RETURN` |
| Subscription delivery marked **Sent** | − quantity | `SUBSCRIPTION` |
| Vendor sells in the shop (**counter bill**) | − quantity per line, bill saved with number and payment method | `COUNTER_SALE` |
| Vendor restocks or corrects | ± manual adjust with a reason | `IN` / `OUT` / `SET` |

Every change writes a `BranchStockMovement` row recording who made it, why, and the order or delivery it belongs to. Stock is changed only by `branch-stock.service.ts`.

## 4. Location, distance and delivery cost

- **Customer location:** the delivery address, or a detected point.
  - **Detected:** GPS through `expo-location`, then reverse-geocoded on the device (free, no API key).
  - **Manual:** a typed address, geocoded on the device.
  - Addresses now store `lat` / `lng`. The app sends the current point as the `X-Location: <lat>,<lng>` header for browsing.
- **Vendor location:** the vendor sets the shop's point in the portal, by browser geolocation or by typing coordinates.
- **Distance:** `DistanceProvider` interface.
  - **Default:** haversine × `ROAD_FACTOR` (1.3), which approximates road distance and needs no key.
  - **Road distance:** set `ORS_API_KEY` to use OpenRouteService's free tier; results are cached per branch and address pair.
- **Delivery fee** (per branch, set by the vendor):
  - `fee = max(minDeliveryFee, round(distanceKm × deliveryRatePerKm))`
  - Free when `itemsTotal ≥ freeDeliveryAbove`, if the vendor sets it.
  - Not deliverable beyond `maxDeliveryKm`.
  - Computed only in `pricing/`. Clients never calculate it.

## 5. Choosing a vendor (one vendor per cart)

**Product detail:**
- Shows **every** listing of the selected variant, each with:
  - shop name and distance
  - delivery fee
  - price
  - label: `Open` / `Closed` / `Out of stock` / `Too far`
- The default is the nearest listing that is open and in stock. The customer can pick any other listing, or open the vendor's shop page.

**Cart:**
- The cart belongs to **one branch**. Adding an item from another branch returns `409 CART_BRANCH_CONFLICT`, and the app asks "Start a new cart from <shop>?".
- **Switch shop:** if the cart's branch is closed or missing an item, the app offers the branches that can fulfil the whole cart (or most of it), each with distance and fee.
- **Catalog cards:**
  - Show the price from the nearest open, in-stock listing within range, with the line "N shops nearby".
  - With no location set, they show the lowest listing price.

## 6. Orders, commission and payouts

- An order belongs to one branch, and through it one vendor: `Order.branchId` and `Order.vendorId`.
- The vendor manages its own orders (confirm, pack, assign one of its riders, out for delivery, delivered). The admin can act on any order.
- **Commission:** the admin sets `Vendor.commissionPercent`, stored in basis points (1250 = 12.5%).
  - At checkout the order snapshots `commissionAmount = round(itemsTotal × rate)` and `vendorEarning = itemsTotal − commissionAmount + deliveryFee`.
  - Coupons and coins are platform-funded, so they reduce what the customer pays, not what the vendor earns.
- **Payouts:**
  - The admin creates a payout for a vendor and date range from delivered, unsettled orders and subscription deliveries. It holds the gross, the commission and the net.
  - It is marked **Paid** with a reference. Settled orders and deliveries link to the payout, so nothing is counted twice.
  - The vendor sees the same statements.

## 7. Delivery partners

- Riders belong to a vendor (`Rider.vendorId`), and vendors manage their own riders.
- On assignment, the rider receives the customer's name, phone, address and a Google Maps link to the delivery point, plus the order items and the amount to collect. This goes by email now, with a WhatsApp click-to-chat link included and WhatsApp itself later.
- The customer sees the rider's name, phone, vehicle and WhatsApp link on the order. This already exists.

## 8. Subscriptions (daily milk, vegetables, village monthly plans)

- A vendor turns on the **daily needs** switch (`Vendor.subscriptionsEnabled`) before it can create plans.

**Vendor creates a plan** (`SubscriptionPlan`):
- Fields:
  - a listing and the quantity per delivery
  - **terms per period** (`SubscriptionPlanPrice`, one row each for `WEEKLY` and/or `MONTHLY`):
    - price per delivery (monthly is usually cheaper)
    - delivery fee, charged per delivery or as one flat amount for the period (0 = free delivery; vendors typically make monthly delivery free because the rider goes there every day anyway)
  - time slots, such as "6–8 am"
  - an optional daily capacity
- Only active plans from approved vendors are shown.

**Customer subscribes:**
- Picks:
  - the period
  - the start date
  - the delivery days (any weekdays)
  - a slot
  - an address
  - in the advanced menu, specific dates to skip
- **Price breakdown** (pure function `subscription-pricing.ts`):
  - `deliveries × pricePerDelivery × qty` = goods
  - plus delivery: `deliveries × deliveryFee` (per delivery) or `deliveryFee` once (per period)
  - equals the total, showing the exact list of dates
- **Payment plan**, chosen by the customer:
  - `UPFRONT`: the whole total is due before the first delivery
  - `TWO_INSTALMENTS`: half before the start, half at the midpoint (the "EMI" option)
  - `END_OF_PERIOD`: pay for what was actually delivered when the period ends
  - Instalments (`SubscriptionInstalment`) hold the due dates and amounts. Payments are recorded against the subscription, and the ledger shows each instalment as paid, partly paid or overdue.
  - There is no online payment gateway yet, so payments are cash or UPI collected by the vendor or rider and recorded in the portal.
- On subscribe, the server creates one `SubscriptionDelivery` row per date in the period. The schedule is therefore known in advance, and no job is needed to create it.
- **Pause while away:** a date range. Deliveries in the range become `SKIPPED`. Pausing does not extend the period; the customer renews instead.
- **Skip one day:** allowed until 8 pm the day before.

**Vendor runs deliveries:**
- The **Today** page lists every scheduled delivery for the date, grouped by slot.
- **Sent** (per row or "Mark all sent") deducts stock and sets `DELIVERED`. **Missed** records a reason and charges nothing.

**Delivery partner's plan:**
- The vendor assigns a rider to each subscription.
- Every rider has a private link (`/r/<token>`, no login) that shows their schedule: today's drops and the whole month, each with the customer's name, phone (tap to call and confirm), address and a map link. The rider can mark a drop delivered from that page, which works the same as the vendor marking it Sent.
- The vendor sends the link to the rider over WhatsApp (click-to-chat with the message prefilled) and email.

**Payments:**
- Each subscription keeps a ledger:
  - **charged:** the delivered rows
  - **paid:** `SubscriptionPayment` rows recorded by the vendor when it collects cash or UPI, or the customer pays a rider
  - **balance due:** charged minus paid
- The customer sees the same ledger and downloads receipts.

**Daily essentials:** the customer home screen gets a section listing nearby subscription plans.

**Daily job (Vercel Cron → `POST /api/v1/cron/daily`, guarded by `CRON_SECRET`, 18:00 IST):**
- Emails customers about tomorrow's deliveries.
- Warns vendors whose stock is below tomorrow's subscription need.
- Expires finished subscriptions.

## 9. Receipts, invoices and records

Everything downloadable is a PDF generated server-side with `pdfkit`, which has no native dependencies and runs on Vercel:

| Document | Who sees it |
|---|---|
| Order invoice (`INV-…`): vendor, customer, items, tax-free totals, payment method | customer, vendor, admin |
| Subscription statement: plan, every delivery, payments, balance | customer, vendor, admin |
| Payment receipt (`RCPT-…`) for each subscription payment | customer, vendor, admin |
| Payout statement: orders and deliveries settled, commission, net | vendor, admin |
| Counter bill (`BILL-…`) for an in-shop sale | vendor (to print or share) |

## 10. Support tickets

- Categories:
  - `ORDER_ISSUE` and `SUBSCRIPTION_ISSUE`. These are **minor**, go to the vendor of that order or subscription, and the admin sees them too.
  - `APP_BUG`, `PAYMENT`, `ACCOUNT` and `VENDOR_COMPLAINT`. These are **major** and go to the admin only; the vendor never sees them.
- The admin can take over or escalate any ticket.
- **The ticket view shows the full context:** the customer's profile, contact details and order count, the linked order (items, status history, rider, payments) or subscription (schedule and ledger), and the message thread.
- Statuses are `OPEN → IN_PROGRESS → RESOLVED → CLOSED`. A new customer reply reopens a resolved ticket.
- New tickets and replies are emailed to the other side.

## 11. Chat (customer ↔ vendor)

- One conversation per customer and vendor pair, opened from a shop page, a product's vendor, or an order.
- Placing an order posts a system message ("New order #HT…") into that conversation, so the vendor sees it on their Messages page.
- Messages are polled every 5 s while a thread is open and every 30 s for unread counts. Vercel cannot hold sockets, so there are no WebSockets.

## 12. Excel reports (vendor, and admin per vendor)

`GET /vendor/reports/export?from=&to=` streams an `.xlsx` file built with `exceljs`. The portal offers **This week**, **This month**, **Last month** and a custom range. Online orders, counter bills and subscription deliveries are all included. Sheets:

1. **Summary:** revenue, orders, average order value, commission, net earnings, profit
2. **Sales:** every order line, with date, product, quantity, price, cost, profit
3. **Best sellers:** units, revenue and profit per product
4. **Inventory:** stock, threshold, stock value at cost, movements in range
5. **Subscriptions:** plans, active subscribers, deliveries, collected and due amounts
6. **Payouts**

Profit is `(price − costPrice) × quantity`. Lines without a cost price are flagged as "cost missing".

**Admin reports:** the same workbook for any vendor, plus a platform workbook comparing all vendors (orders, revenue, commission, subscriptions, tickets, low stock) for the chosen range.

## 13. Live stock without WebSockets

- The product detail, cart and vendor stock screens refetch every 15 s while visible (React Query `refetchInterval`), and on app focus.
- Checkout always re-validates stock inside the transaction, so a stale screen can never oversell.

## 14. Platform constraints (Vercel)

| Constraint | Consequence |
|---|---|
| Serverless: no long-lived process | Daily job runs on Vercel Cron; polling instead of push; notifications are awaited where a request must not end before they send |
| Read-only file system | Uploads (vendor ID proof, product images) need object storage: the `uploads` module gets a Vercel Blob driver (`BLOB_READ_WRITE_TOKEN`) alongside local disk for dev |
| Hobby plan crons run at most daily | One daily job does everything |

## 15. Module layout (backend)

New or changed modules, each following routes → service → Prisma:

| Module | Responsibility |
|---|---|
| `vendors` | signup, approval, profile, staff, admin vendor management |
| `branches` | shop location, hours, online switch, delivery settings, nearby search (existing code, now mounted) |
| `listings` | vendor product and listing CRUD, offers for a variant |
| `branch-stock` | the only place listing stock changes; movements; low-stock alerts |
| `geo` | `DistanceProvider` (haversine and ORS), location parsing |
| `pricing` | adds `deliveryFeeFor()` and `subscription-pricing.ts`, both pure |
| `cart`, `orders` | single-branch cart, vendor-scoped order management, commission snapshot |
| `subscriptions` | plans, subscribe, schedule, pause/skip, deliveries, payments, ledger |
| `payouts` | statements and settlement |
| `tickets` | categories, routing, context view, thread |
| `chat` | conversations and messages |
| `documents` | PDF invoices, statements, receipts |
| `reports` | Excel export (vendor, per-vendor for admin, platform) |
| `counter-sales` | in-shop bills |
| `audit` | write and read the audit log |
| `admins` | super admin manages admin accounts |
| `cron` | daily job |

## 16. Out of scope for now

- **Online payments.** No payment gateway (Razorpay or similar) is integrated, so "EMI" means instalments collected as cash or UPI and recorded by the vendor. A gateway can be added later behind the same ledger.
- **Rider app.** Riders use their schedule link instead of a separate app.
- **Live rider tracking on a map.** The customer sees rider details and can call them; positions are not tracked.
