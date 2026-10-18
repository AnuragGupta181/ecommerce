# Architecture

## 1. System overview

```
┌──────────────────────┐        ┌───────────────────────┐
│  Mobile app (Expo)   │        │ Admin dashboard (Next)│
│  customers & guests  │        │  store owner / staff  │
└──────────┬───────────┘        └───────────┬───────────┘
           │  HTTPS JSON  /api/v1            │
           └───────────────┬─────────────────┘
                           ▼
              ┌────────────────────────┐
              │  Backend API (Express) │──── Nodemailer ──► SMTP (Mailpit in dev)
              │  TypeScript, Zod, JWT  │──── WhatsApp ────► Meta Cloud API / Twilio / log
              └──────────┬─────────────┘──── Storage ─────► local /uploads (S3-ready)
                         │ Prisma (adapter-pg)
                         ▼
              ┌────────────────────────┐
              │ PostgreSQL (Neon)      │
              └────────────────────────┘
```

- The **backend is the single source of truth.** Both clients are thin and talk only to `/api/v1`.
- **Auth** uses a stateless JWT access token plus a DB-backed refresh token (rotated on every refresh, hashed at rest). This lets admins revoke sessions and lets logout invalidate a session server-side.
- **Notifications** run *after* the DB transaction commits. A failure is recorded in `NotificationLog` and never rolls back business data.

## 2. Repository layout

```
ecommerce/
├── backend/              Express API
│   ├── prisma/           schema.prisma, migrations, seed.ts
│   ├── src/
│   │   ├── config/       env.ts (Zod-validated environment)
│   │   ├── lib/          prisma, logger, jwt, password, money, pagination, slug
│   │   ├── middleware/   auth, validate, error-handler, rate-limit
│   │   ├── modules/      one folder per domain (see §3)
│   │   ├── services/     notify (email, whatsapp, templates), storage
│   │   ├── app.ts        express app factory (used by tests)
│   │   └── server.ts     process entry
│   └── tests/            vitest unit + integration
├── frontend/             Next.js 16 admin dashboard (pnpm)
│   ├── proxy.ts          route guard + access-token refresh
│   ├── app/(auth)/login  login page + login/logout Server Actions
│   ├── app/(dashboard)/… one route per admin section (shared sidebar/top-bar layout)
│   ├── app/session-expired  route handler that clears a rejected session
│   ├── components/       ui/ (kit), layout/ (sidebar, top bar) + feature components
│   └── lib/              auth/ (cookie contract), server/ (api, session, action helpers), format, types
├── mobile/               Expo SDK 57 app (yarn)
│   └── src/
│       ├── app/          Expo Router routes: (tabs) pill navigator, product/[slug], search, checkout, orders, login
│       ├── components/   ui/ kit, navigation/ (PillTabBar) + feature components
│       ├── lib/          api, auth store, query client, theme, format, types
│       └── hooks/        React Query hooks per domain, useRequireAuth
├── docs/                 this documentation
├── tests/                cross-app smoke tests
└── docker-compose.yml    local Postgres (optional) + Mailpit
```

## 3. Backend architecture

### 3.1 Layers

```
route (auth guard) ─► handler: schema.parse(req) ─► service ─► prisma
                                                        │
                                                        └─► notify.inBackground(...) after commit
```

| Layer | Responsibility | Rules |
|---|---|---|
| `*.routes.ts` | Router plus thin handlers: parse input with Zod, call the service, send `ok(data, meta)`. `auth` and `settings` split handlers into `*.controller.ts` | No business logic, no Prisma |
| `*.schema.ts` | Zod schemas for body/query/params | The single source of input types |
| `*.service.ts` | Business rules, transactions | Throws `AppError` and never touches `req`/`res` |
| `*.presenter.ts` | Response shapes shared across services (e.g. product card) | Pure |
| `lib/` | Pure helpers | No framework imports |

### 3.2 Modules

| Module | Purpose |
|---|---|
| `auth` | register, login, refresh, logout, me, password reset OTP |
| `users` | profile (customer), customer admin (list, block) |
| `addresses` | customer address book |
| `categories` / `brands` | catalog taxonomy |
| `products` | catalog listing/search/detail plus admin CRUD of products, variants and images |
| `inventory` | stock movements, adjustments, low stock |
| `wishlist` / `cart` | shopping state per user |
| `pricing` | pure price calculation used by cart and checkout |
| `coupons` | validation, availability, admin CRUD |
| `coins` | ledger, balance, earn/redeem/adjust |
| `orders` | checkout, customer orders, admin fulfilment, status machine |
| `riders` | rider registry, assignment |
| `reviews` | customer reviews, moderation, rating aggregates |
| `banners` | home merchandising |
| `notifications` | in-app notifications and the delivery log |
| `settings` | store-level configuration (single row) |
| `uploads` | image upload |
| `dashboard` | admin analytics |
| `vendors` / `branches` | shop signup and approval, profile, staff, branches with hours, radius and delivery rates |
| `listings` / `branch-stock` | a shop's price and stock for a catalog variant; `branch-stock` is the only writer of shop stock |
| `geo` | `X-Location` parsing (`requestPoint`) and distances |
| `counter-sales` | walk-in bills that take shop stock |
| `chat` | customer ↔ shop conversations (polled, no sockets) |
| `subscriptions` | plans, subscribe/quote, skip and pause, daily drops, rider schedule links, payments and the ledger |
| `tickets` | support tickets routed to the shop (MINOR) or the platform (MAJOR) |
| `payouts` | settlement between the platform and a shop; pure maths in `settlement.ts` |
| `documents` | invoice, receipt and statement PDFs behind short-lived signed links |
| `reports` | Excel workbooks per shop and period |
| `audit` / `admins` | audit log of vendor and admin actions; super-admin management of admins |
| `cron` | the daily 18:00 IST job behind `CRON_SECRET`: tomorrow's delivery and instalment reminders, stock warnings, completing finished subscriptions |

### 3.3 Conventions

- **API prefix:** `/api/v1`.
- **Success response:** `{ "data": … , "meta"?: { page, limit, total, totalPages } }`.
- **Error response:** `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details"?: … } }`.
- **Money** is an integer number of paise everywhere. Clients format it with `formatINR(paise)`.
- **IDs** are `cuid` strings. Order numbers are human-friendly: `HT` + `YYMMDD` + 5 random digits.
- **Soft delete:** products are archived (`isActive = false`) when orders reference them. Otherwise they are hard-deleted.
- **Transactions** cover order placement, cancellation, returns and stock adjustments.

### 3.4 Order state machine

The allowed transitions live in `modules/orders/order-status.ts`. Each transition:

1. Validates the move.
2. Writes `OrderStatusHistory`.
3. Applies side effects:
   - restock on cancel/return
   - coin credit on delivery
   - coin reversal on return
4. Queues notifications after commit.

### 3.5 Notifications

```
notify.riderAssigned(order) ─┬─► email(customer)   ─┐
                             ├─► email(rider)       ├─► NotificationLog row each
                             ├─► email(admin)       │   (SENT | FAILED | SKIPPED)
                             ├─► whatsapp(customer) │
                             ├─► whatsapp(rider)    │
                             ├─► whatsapp(admin)   ─┘
                             └─► in-app Notification(customer)
```

`WHATSAPP_PROVIDER` selects the provider: `meta`, `twilio` or `log`. With `log`, the message is recorded and the admin UI offers `wa.me` deep links.

## 4. Admin dashboard architecture

The admin dashboard is a server-first **Backend-for-Frontend (BFF)** built on Next.js 16 App Router with `cacheComponents` enabled.

```
Browser ──(httpOnly cookies)──► Next.js server ──(Bearer JWT)──► Express API
            Server Components (SSR)   │
            Server Actions (mutations)│  lib/server/api.ts  (server-only)
            proxy.ts (route guard)    │  lib/server/session.ts
```

- **Rendering strategy:**

  | What | Strategy | Why |
  |---|---|---|
  | Layout chrome: sidebar, top bar, page headers, login page | **Static shell** (prerendered at build, SSG) | Instant paint, no request data |
  | Tables, detail pages, KPIs | **SSR**, streamed behind `<Suspense>` | Authenticated, request-time data |
  | Forms, dialogs, filters, charts | Client components hydrated inside SSR pages | Interactivity |
  | Mutations | **Server Actions** → API → `revalidatePath` / `refresh()` | No tokens in the browser |

- **Auth:**
  - The login Server Action calls `POST /auth/login` and stores the access and refresh tokens in **httpOnly, Secure, SameSite=Lax cookies** on the admin domain. Tokens are never readable by client JS.
  - `proxy.ts` redirects unauthenticated requests to `/login`. When the access token is missing or about to expire, it refreshes the session and forwards the new tokens to both the render and the browser, so Server Components never need to set cookies.
  - Parallel requests (for example link prefetches) share one refresh per token inside the proxy, and the backend tolerates a brief rotation race (see `/auth/refresh` in [API.md](API.md)).
  - If the backend rejects a session mid-render, `/session-expired` clears the cookies and sends the admin to `/login`. This prevents a redirect loop.
  - `lib/server/session.ts` reads the cookies. `requireAdmin()` is the first call in every Server Action.
- **Data access layer:** `lib/server/api.ts` is the only place that calls the backend, and it is marked `server-only`. Every Server Action re-verifies the session.
- **Filters and pagination** live in URL `searchParams`. They are shareable and SSR-friendly.
- **UI kit** in `components/ui`: Button, Input, Select, Textarea, Badge, Card, Table, Modal, Drawer, Tabs, Pagination, EmptyState, StatCard, Skeleton.

### 4.1 Admin and vendor areas

One Next.js app serves both portals:

| Area | Path | Who | Guard |
|---|---|---|---|
| Admin | `/` (`app/(dashboard)/`) | `ADMIN`; super admins also get Admins and Audit | `requireAdmin()` / `requireSuperAdmin()` |
| Vendor | `/vendor` (`app/vendor/(portal)/`) | `VENDOR` owners and staff | `requireVendor()` |
| Public | `/vendor/signup`, `/r/<token>` (rider schedule) | anyone | none; the rider page is keyed by a private token |

```
request ─► proxy.ts ─► pathAllowed(role, path)? ─no─► homeFor(role)
                         │yes
                         ▼
             page (Server Component) ─► lib/server/api.ts ─► /api/v1/admin/* or /api/v1/vendor/*
```

- The `haat_admin` cookie carries the display profile (`name`, `role`, `vendorRole`, `isSuperAdmin`) so the shell renders the right menu without a request. It is never trusted for authorization: the backend checks the JWT on every call.
- Shared views (`OrderView`, `TicketView`, `PayoutPage`) take Server Actions as props. The admin and vendor pages pass actions that call their own endpoints, so one component serves both areas.
- Files (invoices, receipts, statements, Excel reports) stream through `app/download/route.ts` and `app/vendor/download/route.ts`. They forward only allow-listed backend paths, adding the session token.
- Admins see shop stock read-only. Stock changes only happen in the vendor area through `branch-stock`.

## 5. Mobile app architecture

- Expo SDK 57 and Expo Router (file-based routes).
- **State:**
  - Server state: TanStack Query, one hook file per domain in `src/hooks/`.
  - Session: Zustand `auth` store, persisted to `expo-secure-store`.
  - Device preferences: recent searches, recently viewed, onboarding-seen and the voice-search language, persisted to `AsyncStorage`.
- **Auth gate:** the `useRequireAuth()` hook returns `guard(action)`. For guests it opens the login sheet instead of running the action, and it resumes the action after login.
- **Navigation:**
  - `(tabs)` uses a custom `PillTabBar`: a floating, rounded pill where the active tab is a yellow capsule with a label.
  - Stack screens: product, listing, search, cart, checkout, orders, account sub-pages.
- **Voice search** (`expo-speech-recognition`, on-device):

```
mic tap ─► useVoiceSearch()                      src/hooks/use-voice-search.ts
             │  getPermissionsAsync()
             │  └─ not granted & canAskAgain ─► requestPermissionsAsync()  (OS dialog)
             │  └─ not granted & !canAskAgain ─► state "denied" (never re-prompts)
             │  supportsOnDeviceRecognition / getSupportedLocales → installed model?
             ▼
           start({ lang, interimResults, requiresOnDeviceRecognition })
             │  result(isFinal:false) ─► live partial text
             ▼
           result(isFinal:true) ─► normalizeTranscript() ─► setQ() ─► existing suggestions
```

  - `src/components/search/voice-search-modal.tsx` renders the states on the shared `Sheet`; the
    mic pulse uses React Native's `Animated` (Reanimated is unused elsewhere in the app, and
    avoiding it keeps the Jest setup free of worklet mocks).
  - `src/lib/voice-query.ts` is pure: filler/punctuation stripping, the 100-char cap and the
    supported-locale list. It mirrors `backend/src/modules/products/search-term.ts`.
  - Chosen language persists in `AsyncStorage` through `deviceStore.voiceLocale`.
  - **This makes the app a native build.** The speech module is not in Expo Go, so run
    `npx expo run:android` or an EAS development build.

### 5.1 Marketplace on the phone

- **Location:** `src/lib/location-store.ts` holds the chosen point (GPS, served area or pincode). `src/lib/api.ts` sends it as `X-Location` on every request, and the server ranks shops and offers by it.
- **One shop per cart:** `useAddToCartResolvingShop` catches `CART_SHOP_CONFLICT` and asks whether to replace the cart. Checkout handles `SHOP_UNAVAILABLE` (shop closed or out of range) by offering another shop.
- **Live data without sockets:** `useLiveInterval` turns polling on only while the screen is focused. Product stock, the cart, open tickets and chat use it. A chat thread lives in the React Query cache and each poll fetches only messages `after` the newest one.
- **Documents:** the app asks `/documents/:kind/:id/link` for a short-lived signed URL, rewrites its host with `reachableDocumentUrl` (the API may sit behind a LAN IP), and opens it with `expo-web-browser`.
- **Web build:** react-native-web with `output: "single"`. `src/lib/secure-storage.ts` falls back to `localStorage` on web, where SecureStore does not exist. Voice search is native only.

## 6. Data model (summary)

See [DATABASE.md](DATABASE.md) for every field.

```
User 1─* Address        User 1─* Order 1─* OrderItem *─1 ProductVariant
User 1─* CartItem       Order 1─* OrderStatusHistory
User 1─* WishlistItem   Order *─1 Rider
User 1─* CoinTxn        Order *─1 Coupon      Coupon 1─* CouponRedemption
User 1─* Review *─1 Product 1─* ProductVariant 1─* StockMovement
Category 1─* Category (tree)   Category 1─* Product *─1 Brand
Product 1─* ProductImage       Banner   Settings(1)   Notification   NotificationLog
RefreshToken  PasswordReset

Marketplace:
Vendor 1─* Branch 1─* BranchVariantStock (listing) *─1 ProductVariant
BranchVariantStock 1─* BranchStockMovement
Vendor 1─* User (staff)   Vendor 1─* Rider   Order *─1 Vendor, *─1 Branch, *─1 Payout
SubscriptionPlan *─1 BranchVariantStock      SubscriptionPlan 1─* SubscriptionPlanPrice
Subscription 1─* SubscriptionDelivery *─1 Payout
Subscription 1─* SubscriptionPause / SubscriptionPayment / SubscriptionInstalment
Ticket 1─* TicketMessage   Conversation 1─* ChatMessage   CounterSale   AuditLog
```

## 7. Deployment architecture

See [DEPLOYMENT.md](DEPLOYMENT.md).

```
GitHub ─► CI (lint, type-check, test)
   ├─► Backend: Docker image ─► Render / Railway / Fly / EC2  ──► Neon Postgres
   ├─► Admin: Vercel (or Docker)                                  SMTP provider
   └─► Mobile: EAS Build ─► Play Store / App Store, EAS Update    WhatsApp Cloud API
```

Live today, all on Vercel: the API (`backend/`, serverless Express), the portal (`frontend/`) and the app's web build (`mobile/`, `expo export`). Render or AWS come later; see [DEPLOYMENT.md](DEPLOYMENT.md) §0.
