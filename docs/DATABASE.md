# Database

The database is PostgreSQL on Neon, accessed through Prisma 7 with `@prisma/adapter-pg`. The source of truth is [backend/prisma/schema.prisma](../backend/prisma/schema.prisma).

- Every money column is an **integer number of paise**.
- Coins are integers, where 1 coin = ₹1.
- IDs are `cuid()` strings.

## Entity map

```
User ─┬─< RefreshToken            Category ─< Category (2-level tree)
      ├─< PasswordReset           Category ─< Product >─ Brand
      ├─< Address                 Product ─┬─< ProductImage
      ├─< CartItem >── ProductVariant      ├─< ProductVariant ─< StockMovement
      ├─< WishlistItem >── Product         └─< Review >── User
      ├─< CoinTransaction >── Order?
      ├─< CouponRedemption >── Coupon, Order (1:1)
      ├─< Notification
      ├─< Referral (as referrer / referee) >── Order?
      └─< Order ─┬─< OrderItem (price snapshot) >── ProductVariant, Product
                 ├─< OrderStatusHistory
                 ├─< NotificationLog
                 ├─< Referral?
                 └── Rider?
Settings (single row, id = 1)    Banner    SearchTerm

Vendor ─┬─< User (VENDOR: OWNER / STAFF)
        ├─< Branch (shop) ─┬─< BranchVariantStock (listing: price, mrp, costPrice, stock) >── ProductVariant
        │                  │        └─< BranchStockMovement
        │                  ├─< CartItem (one shop per cart)
        │                  ├─< Order (vendorId, commission snapshot, payoutId)
        │                  └─< BranchStatusLog, BranchRider
        ├─< Rider (linkToken for the schedule page)
        ├─< SubscriptionPlan ─< SubscriptionPlanPrice (per period)
        │        └─< Subscription ─┬─< SubscriptionDelivery (one row per date)
        │                          ├─< SubscriptionPause, SubscriptionInstalment
        │                          └─< SubscriptionPayment (receipt)
        ├─< Payout ─< Order, SubscriptionDelivery (settled rows)
        ├─< CounterSale ─< CounterSaleItem
        ├─< Ticket ─< TicketMessage            (Ticket also links User, Order?, Subscription?)
        └─< Conversation ─< ChatMessage       (Conversation is unique per User + Vendor)
AuditLog (actor, vendor, action, entity, data)    Counter (document numbering per series and year)
```

## Tables

| Model | Purpose | Notable columns |
|---|---|---|
| `User` | customers, admins, vendor staff | `role` CUSTOMER\|ADMIN\|VENDOR, `vendorId` + `vendorRole` OWNER\|STAFF for vendor logins, `isSuperAdmin`, `isBlocked`, `coinBalance` (denormalised, changed only via `changeCoins`), `referralCode` (unique uppercase, e.g. `HAAT4X8K`) |
| `RefreshToken` | sessions | `tokenHash` (SHA-256), `revokedAt`, `rotatedAt` (set only by rotation, so a racing refresh can be told apart from logout or theft), `expiresAt` |
| `PasswordReset` | OTP reset | `otpHash`, `attempts` (max 5), `expiresAt` (10 min) |
| `Address` | address book | `isDefault` (one per user, enforced in the service), `lat`/`lng` delivery point |
| `Category` | 2-level tree | `parentId`, `sortOrder`, `isActive` |
| `Brand` | — | `slug` unique |
| `Product` | catalog item | `specs` JSON `[{label,value}]`, `highlights[]`, `tags[]`. Denormalised: `minPrice`, `minMrp`, `discountPercent` (cheapest active variant), `ratingAvg`, `ratingCount`, `soldCount` |
| `ProductVariant` | catalog unit (SKU) | `mrp`, `price` are **reference** values; shop prices and stock live on listings. `stock` only matters for orders from before shops |
| `StockMovement` | inventory audit | `type` IN\|OUT\|SET\|SALE\|CANCEL\|RETURN, signed `quantity`, `stockAfter`, `orderId?` |
| `CartItem` | cart line | unique (`userId`, `variantId`), `branchId` (every line of a user's cart shares one shop) |
| `WishlistItem` | — | PK (`userId`, `productId`) |
| `Coupon` | promotions | `type` PERCENT\|FLAT, `value`, `maxDiscount`, `minOrderValue`, window, `usageLimit`, `perUserLimit`, `usedCount`, `firstOrderOnly` |
| `CouponRedemption` | usage per order | unique `orderId`. Deleted when the order is cancelled |
| `CoinTransaction` | coin ledger | `type` EARN\|REDEEM\|REFUND\|REVERSE\|ADJUST\|BONUS, signed `amount`, `balanceAfter` |
| `Referral` | customer referral program | `referrerId`, `refereeId` (unique), `status` PENDING\|COMPLETED\|REVERSED, `orderId` (unique, first delivered order), `referrerCoins`, `refereeCoins`, timestamps |
| `Order` | — | `orderNumber` (`HTyymmddNNNNN`), `status`, `paymentMethod`, `paymentStatus`, `shippingAddress` JSON snapshot. Price breakup: `itemsMrp`, `itemsTotal`, `couponDiscount`, `coinsUsed`, `deliveryFee`, `payable`. Also `coinsToEarn`, `coinsEarned`, `riderId`, timestamps. Marketplace: `branchId`, `vendorId`, `distanceKm`, `commissionBps`, `commissionAmount`, `vendorEarning`, `payoutId`, `invoiceNumber` (`INV-yyyy-nnnnnn`) |
| `OrderItem` | immutable snapshot | `productName`, `variantLabel`, `sku`, `imageUrl`, `mrp`, `price`, `costPrice` (for profit), `quantity`, `lineTotal` |
| `OrderStatusHistory` | timeline | `status`, `note`, `actorId`, `actorRole` |
| `Rider` | delivery partners | `vendorId` (the shop they work for), `phone` unique (E.164), `whatsapp`, `email`, `vehicleType`, `vehicleNumber`, `idProof*`, `isActive`, `linkToken` (private schedule page) |
| `Review` | — | unique (`userId`, `productId`), `isHidden` |
| `Banner` | merchandising | `placement` HOME_CAROUSEL\|HOME_STRIP, `linkType` NONE\|PRODUCT\|CATEGORY\|SEARCH\|URL, window |
| `Notification` | in-app inbox | `type` ORDER\|PROMO\|SYSTEM, `data` JSON (e.g. `orderId`), `readAt` |
| `NotificationLog` | email/WhatsApp delivery log | `channel`, `recipientType`, `status` SENT\|FAILED\|SKIPPED, `error`. OTP bodies are redacted |
| `Settings` | store config | fees, thresholds, coin rules, referral rules (`referralEnabled`, `referralReferrerCoins`, `referralRefereeCoins`), return window, payment toggles, admin contacts |
| `SearchTerm` | trending searches | `count` |
| `Vendor` | a shop owner's business | `status` PENDING\|APPROVED\|REJECTED\|SUSPENDED, `commissionBps` (1000 = 10%), `subscriptionsEnabled`, payout and ID-proof details |
| `Branch` | a shop location | `vendorId`, `lat`/`lng`, `deliveryRadiusKm`, `deliveryRatePerKm`, `minDeliveryFee`, `freeDeliveryAbove`, `opensAt`/`closesAt` (IST "HH:MM"), `isOnline`, `offlineMessage` |
| `BranchVariantStock` | a **listing**: one shop selling one variant | `price`, `mrp`, `costPrice` (private), `stock`, `lowStockThreshold`, `isAvailable`; unique (`branchId`, `variantId`) |
| `BranchStockMovement` | listing stock log | `type` IN\|OUT\|SET\|SALE\|CANCEL\|RETURN\|SUBSCRIPTION\|COUNTER_SALE, signed `quantity`, `stockAfter`, `orderId?`, `subscriptionDeliveryId?`, `createdById` |
| `SubscriptionPlan` / `SubscriptionPlanPrice` | a vendor's recurring offer | plan: `listingId`, `quantityPerDelivery`, `slots[]`, `capacity`; price per `period` WEEKLY\|MONTHLY: `pricePerDelivery`, `deliveryFee`, `deliveryFeeMode` PER_DELIVERY\|PER_PERIOD |
| `Subscription` | a customer's plan | `number` (`SUB-…`), `startDate`/`endDate` (DATE), `weekdays` bitmask (Mon=1…Sun=64), `slot`, locked terms, `paymentPlan` UPFRONT\|TWO_INSTALMENTS\|END_OF_PERIOD, `riderId`, `shippingAddress` snapshot |
| `SubscriptionDelivery` | one drop | unique (`subscriptionId`, `date`), `status` SCHEDULED\|SKIPPED\|DELIVERED\|MISSED\|CANCELLED, `quantity` (listing units), `goodsAmount`, `deliveryFee`, `payoutId?` |
| `SubscriptionPause` / `SubscriptionInstalment` / `SubscriptionPayment` | schedule and money | pause date range; instalment `dueDate` + `amount` (recomputed when the schedule changes); payment `receiptNumber` (`RCPT-…`), signed `amount` (negative = refund), `method` CASH\|UPI\|OTHER |
| `Payout` | settlement with a vendor | `number` (`PAY-…`), period, counts, `grossAmount`, `commissionAmount`, `netAmount` (> 0 platform pays vendor), `status` PENDING\|PAID, `reference` |
| `CounterSale` / `CounterSaleItem` | in-shop bill | `number` (`BILL-…`), `total`, `method`; items snapshot `price`, `costPrice`, `quantity` |
| `Ticket` / `TicketMessage` | support | `number` (`TKT-…`), `category`, `level` MINOR (shop) \| MAJOR (platform), `status`, `orderId?`, `subscriptionId?`, `vendorId?`; messages with `authorRole` CUSTOMER\|VENDOR\|ADMIN\|SYSTEM |
| `Conversation` / `ChatMessage` | customer ↔ shop chat | unique (`userId`, `vendorId`), unread counters per side; messages may reference an `orderId` |
| `AuditLog` | who did what | `actorId`, `actorRole`, `vendorId`, `action` (e.g. `vendor.approve`, `stock.adjust`), `entity`, `entityId`, `data` JSON |
| `Counter` | document numbering | `key` `INV-2026`, `value` (atomic increment) |

## Integrity rules (enforced in services)

- **Stock never goes negative.** It is changed with a conditional `UPDATE … WHERE stock >= n`, which is safe under concurrent checkouts.
- **Listing stock changes only in `branch-stock.service.ts`**, always with a `BranchStockMovement` row. Online orders, cancels, returns, subscription drops and counter bills deduct automatically; vendors correct manually with a reason. Admins can read stock but never change it.
- **A sale is settled once:** creating a payout links its orders and drops (`payoutId`) with a conditional update.
- **Subscriptions lock their terms** (price, fee, mode) when created; plan price changes apply to new subscribers only.
- **The coin balance never goes negative.** It uses the same conditional update and writes a ledger row in the same transaction.
- **Coupon global limits** use a conditional `usedCount < usageLimit` increment at order time.
- **Order status updates** are conditional on the previous status (optimistic concurrency).
- **Records referenced by orders are archived instead of deleted:** products, variants, riders and coupons.

## Indexes

Listing and sorting are covered by `Product(isActive, minPrice | soldCount | createdAt | isFeatured)` and `Product(categoryId, isActive)`. Orders are indexed by `(userId, createdAt)`, `(status, createdAt)` and `riderId`.

**Scaling search:** add a `pg_trgm` GIN index on `Product.name` and switch `q` to trigram similarity once the catalog grows past a few thousand items.

## Migrations

```bash
pnpm db:migrate --name <change>   # dev: creates and applies a migration (uses DIRECT_URL)
pnpm db:deploy                    # prod/CI: applies pending migrations
pnpm db:seed                      # idempotent demo data + admin
```
