# Haat — Master Build Plan

> Living document. Every task is ticked as soon as it is finished and verified.
> Last updated: 2026-10-15. Multi-branch & vendor management system (Phase 9) in progress.
> **Next:** Mount branch routes, implement branch context & inventory isolation, wire admin and mobile branch features. Deployment (Phase 7) is parked.

Legend: `[x]` done · `[~]` in progress · `[ ]` todo

---

## Phase 0 — Foundation & documentation

- [x] Inspect workspace (Next.js 16 admin scaffold present, backend/mobile empty)
- [x] Decide stack and architecture (see [ARCHITECTURE.md](ARCHITECTURE.md))
- [x] Write PRD, architecture, design system, flows, testing, deployment docs
- [x] Root README.md + AGENTS.md (+ CLAUDE.md pointer)
- [x] Root `.gitignore`, `docker-compose.yml` (Postgres + Mailpit)

## Phase 1 — Backend core

- [x] Project setup: Express 5, TypeScript (ESM), tsx, ESLint, Vitest
- [x] Env validation with Zod (`src/config/env.ts`)
- [x] Prisma schema: users, addresses, categories, brands, products, variants, images
- [x] Prisma client + seed script (admin, 8 categories / 22 sub, 56 brands, ~180 products, 550 reviews, coupons, banners, riders)
- [x] Error model (`AppError`), validation middleware, async-safe handlers
- [x] Auth: register, login, refresh, logout, me, change password
- [x] Forgot / reset password via email OTP
- [x] Role guard (`CUSTOMER`, `ADMIN`) + optional auth for guest browsing
- [x] Catalog read APIs: categories tree, brands, product list (search, filter, sort, paginate), product detail, suggestions
- [x] Admin catalog CRUD: categories, brands, products + variants + images

## Phase 2 — Backend commerce

- [x] Addresses CRUD (default address)
- [x] Wishlist (add / remove / list)
- [x] Cart (add / update qty / remove / clear / summary with full price breakup)
- [x] Pricing engine (pure, unit tested): MRP, discount, coupon, coins, delivery fee, savings
- [x] Coupons: validate/apply, list available for user, admin CRUD
- [x] Coins: ledger, balance, earn on delivery, redeem at checkout, admin adjust
- [x] Referral system: unique uppercase code (`HAAT4X8K`), attribution validation (self/cyclic guards), delivery rewards, cancel/return reversal
- [x] Checkout → order placement in a DB transaction (stock decrement, coupon usage, coins debit)
- [x] Orders: list/detail for customer, cancel (restock + refund coins), return request
- [x] Inventory: stock movements log, admin adjust, low-stock list

## Phase 3 — Backend operations

- [x] Riders CRUD (name, phone, WhatsApp, email, vehicle, ID proof, active flag)
- [x] Admin order management: status transitions with history, notes
- [x] Assign rider → notifications (email + WhatsApp) to customer, rider and admin
- [x] Notification providers: SMTP email (Nodemailer), WhatsApp (Meta Cloud API / Twilio / log fallback), delivery log table
- [x] In-app notifications for customers
- [x] Reviews: verified-buyer reviews, rating aggregates, admin moderation
- [x] Banners CRUD (home carousel / offer strips)
- [x] Store settings (delivery fee, free-delivery threshold, coin rules, admin contacts)
- [x] Image uploads (local disk driver, S3-ready interface)
- [x] Dashboard stats API (revenue, orders by status, top products, low stock, chart series)
- [x] Customers admin: list, detail, block/unblock
- [x] Refresh-token rotation tolerates parallel refreshes (10 s grace via `rotatedAt`), so prefetches cannot log a user out
- [x] DB pool hardening: stalled Neon connects hung requests for minutes; now connects retry (`lib/db-pool.ts`) and connects/queries have deadlines

## Phase 4 — Admin dashboard (Next.js)

- [x] Theme tokens (yellow/white), layout shell (sidebar + topbar)
- [x] UI kit: Button, Field/Input/Select/Textarea, Card, Badge, Table, Modal, Pagination, StatCard, FilterBar, Switch, ImagePicker, ConfirmAction, EmptyState, Skeleton
- [x] API client + auth (login, token refresh, route guard)
- [x] Route scaffold for every admin section, with error and not-found boundaries
- [x] Dashboard overview (KPIs, revenue chart, recent orders, low stock)
- [x] Products list + create/edit (variants, images, specs) + archive/delete
- [x] Categories & brands CRUD
- [x] Inventory page (stock table, adjust dialog, movement history, low-stock filter)
- [x] Orders list (filters) + order detail (timeline, status update, assign rider, resend notifications)
- [x] Riders CRUD
- [x] Customers list/detail (block, adjust coins)
- [x] Coupons CRUD
- [x] Banners CRUD
- [x] Reviews moderation
- [x] Settings page + notification log
- [x] Referral program admin settings (active toggle, referrer bonus, referee bonus, total calculation) + customer referral relationships

## Phase 5 — Mobile app (Expo / React Native)

- [x] Expo SDK 57 + expo-router + TypeScript scaffold (yarn, `src/` layout)
- [x] Theme tokens and floating bottom pill navigation (cart count badge)
- [x] UI kit: Screen, Text, Button, Input, Card, Chip, Price, RatingChip, QuantityStepper, Sheet, OptionRow, MenuRow, SearchBar, StackHeader, Loading/Error/Empty states
- [x] API client (single-flight token refresh), React Query hooks, auth store (SecureStore)
- [x] Auth gate: `useRequireAuth().guard` opens the login sheet; the action resumes after login/signup
- [x] Splash screen + first-launch onboarding (device flag)
- [x] Login / signup / forgot password (email OTP reset)
- [x] Referral code signup input ("Enter referral code, then open your box.")
- [x] Home: search bar, category strip, banner carousel, product rails with "See all", offer strips, unread-notification dot
- [x] Categories (two-pane), product listing with sort + filters (price, brand, rating, discount, in stock), infinite scroll
- [x] Search with suggestions, recent searches and trending terms
- [x] Product detail: gallery, variants, stock hints, offers, highlights, specs, rating breakdown, all-reviews sheet, similar products, add to cart / buy now
- [x] Wishlist
- [x] Cart: line items (qty, remove, save for later), coupon sheet, coins toggle, server price details
- [x] Checkout: address select/add, payment method (from store settings), note, place order, success screen
- [x] Orders list (status filters) + detail (timeline, rider call/WhatsApp, cancel, return, price breakup)
- [x] Account: profile + password, addresses, coins history, offers, notifications, help, logout
- [x] Account Profile "Refer & earn" card (referral code, native share sheet, live referral stats)
- [x] Write review flow (from delivered order items)
- [ ] First run on an Android emulator / Expo Go: verify fonts, splash, onboarding redirect, pill bar, API reachability via LAN IP (`EXPO_PUBLIC_API_URL`)
- [ ] Manual pass of every flow against the seeded API (expect small layout/data-shape fixes)

## Phase 6 — Quality

- [x] Backend unit tests (pricing engine, order status machine, referral code & attribution integrity)
- [x] Backend integration tests (auth, catalog/inventory, cart → order → rider → delivery, cancel)
- [x] Admin type-check + lint + build
- [x] Order lifecycle verified end to end through the API both clients use (smoke script)
- [ ] Admin UI click-through against a running API (login, CRUD, order status + rider assignment)
- [x] Mobile type-check + lint + Android bundle export (`npx expo export --platform android`)
- [ ] Mobile typed routes: run `yarn start` once so `.expo/types` is generated, then re-run `yarn typecheck`
- [x] Root end-to-end smoke script `tests/smoke/run.mjs` (guest → customer → admin → delivery → review/return → cancel; 42 checks, passing)
- [x] Add `.gitattributes` to normalise line endings (LF in repo; silences CRLF warnings on Windows)

## Phase 7 — Deployment (parked)

- [ ] Backend Dockerfile + production compose
- [ ] Admin Dockerfile / Vercel notes
- [ ] EAS build profiles for mobile
- [ ] GitHub Actions CI (lint, type-check, test)

## Phase 8 — Voice search (on-device STT)

- [x] `expo-speech-recognition` installed; config plugin in `app.json` with mic + speech permission
      strings and the Android `RecognitionService` package queries
- [x] Pure transcript cleanup `mobile/src/lib/voice-query.ts` (filler, punctuation, 100-char cap,
      `en-IN`/`hi-IN` locale list)
- [x] `useVoiceSearch()` state machine: check → prompt only when the OS will show it → never
      re-prompt when blocked → on-device model availability → live partials → cleaned transcript
- [x] `VoiceSearchModal` on the shared `Sheet`: listening / requesting / denied / unavailable /
      error, language chips, Open Settings and "Type instead" fallbacks
- [x] Mic in the search screen input and in the home `SearchBar` (routes to `/search?voice=1`)
- [x] Chosen language persisted via `deviceStore.voiceLocale`
- [x] Backend `normalizeSearchTerm()` keeps spoken sentences out of `SearchTerm` / trending
- [x] Mobile test runner added (`jest-expo`, `mobile/tests/`) — 17 voice tests
- [x] Backend unit tests for search-term normalisation (`tests/unit/voice-search.test.ts`)
- [x] Docs: PRD §5.6, ARCHITECTURE §5, TESTING pyramid + QA checklist, README dev-build note
- [ ] Run on a physical Android device via `npx expo run:android` and walk the manual QA matrix
      (grant / deny / deny-permanently → Settings / Hindi / aeroplane mode / no on-device model)
- [ ] Confirm `/api/v1/products/trending-searches` stays clean after voice searches

## Phase 9 — Multi-branch & vendor management system

### 9.1 Database & schema foundation
- [x] Prisma schema models: `Branch`, `BranchVariantStock`, `BranchStockMovement`, `BranchRider`, `BranchStatusLog`
- [x] Schema relations: `Order.branchId` foreign key and `Rider.branches` many-to-many link
- [x] Prisma migration `20261015042628_add_branches` applied to Neon PostgreSQL database
- [x] Seed data: 3 active branches (Main, North, South) with realistic geo-coordinates and radius, plus `BranchVariantStock` for all active variants
- [x] Prisma client regenerated and verified

### 9.2 Backend core & branch module
- [x] Zod validation schemas (`backend/src/modules/branches/branch.schema.ts`)
- [x] Core service (`backend/src/modules/branches/branch.service.ts`):
  - Pure Haversine distance formula (`haversineKm`)
  - Nearest online branch lookup (`findNearestBranch`)
  - Distance-sorted branch listing (`listBranchesByDistance`)
  - Admin CRUD operations
  - Online/offline operational toggle with audit log (`setBranchOnlineStatus`)
  - Rider-to-branch assignment & unassignment
  - Deterministic order fallback resolution (`resolveBranchForOrder`)
- [x] Response serialization presenter (`branch.presenter.ts`)
- [x] Public router (`/api/v1/branches`) & admin router (`/api/v1/admin/branches`) in `branch.routes.ts`
- [x] Error handling: `SERVICE_UNAVAILABLE` (503) added to `AppError`
- [ ] Mount `branchesRouter` and `adminBranchesRouter` in `backend/src/routes.ts`

### 9.3 Branch-scoped inventory isolation & context
- [ ] Branch context middleware `extractBranchContext()` reading `X-Branch-Id` header or `?branchId=` query parameter
- [ ] Atomic stock mutation & audit logger `applyBranchStockChange()` in `inventory.service.ts`
- [ ] Admin branch inventory management endpoints under `/api/v1/admin/inventory/branches/:branchId/*`
- [ ] Checkout stock decrement and branch attribution in `orders.service.ts`
- [ ] Restock `BranchVariantStock` on order cancellation and returns in `orders.service.ts`
- [ ] Catalog reads (`products.service.ts`) scoped to `BranchVariantStock` when branch context is present

### 9.4 Admin dashboard (Next.js)
- [ ] Add "Branches" navigation link to admin sidebar
- [ ] Branch listing table and create/edit forms (`frontend/app/(dashboard)/branches/`)
- [ ] Branch detail page with `OnlineToggle` switch and operational status badge
- [ ] Per-branch inventory view with stock adjustment and movements modal (`branches/[id]/inventory/`)
- [ ] Branch rider assignment management interface (`branches/[id]/riders/`)
- [ ] Server Actions in `frontend/lib/server/branches.actions.ts`
- [ ] Dashboard overview "Branch Status" operational widget
- [ ] Branch filter in admin orders table and branch display in order detail

### 9.5 Mobile app (Expo / React Native)
- [ ] Geolocation integration via `expo-location` with permission guard
- [ ] Persistent branch store (`mobile/src/lib/branch-store.ts`) with Zustand + AsyncStorage
- [ ] `useBranchDetection()` hook for automatic nearest-branch detection on launch
- [ ] `BranchIndicatorBar` on Home screen showing current branch with tap-to-change action
- [ ] `BranchSelectorSheet` bottom sheet for manual branch override with live distance indicators
- [ ] `BranchOfflineBanner` alerting user when selected branch is offline
- [ ] Automatic `X-Branch-Id` header injection in `mobile/src/lib/api.ts`
- [ ] React Query hooks updated to include branch context in query keys
- [ ] Checkout flow updated to attach resolved `branchId`

### 9.6 Operational status toggles & order fallback
- [ ] Graceful fallback to nearest available branch when customer's preferred branch is offline
- [ ] `503 SERVICE_UNAVAILABLE` response when all branches are offline
- [ ] In-app notification dispatched to customers with in-flight orders when a branch toggles offline

### 9.7 Tests & quality verification
- [ ] Backend unit tests: `haversineKm`, fallback resolution, `applyBranchStockChange`, status log
- [ ] Backend integration tests: public branch endpoints, admin branch CRUD, branch order checkout & restock
- [ ] Mobile unit tests: branch detection hook and Zustand branch store
- [ ] Root end-to-end smoke test script update (`tests/smoke/run.mjs`)
- [ ] Full quality gates: `pnpm typecheck`, `pnpm lint`, `pnpm test` (backend & frontend), `yarn typecheck` (mobile)

### 9.8 Documentation sync
- [ ] Sync `docs/DATABASE.md` with branch models and relations
- [ ] Sync `docs/API.md` with public & admin branch endpoints
- [ ] Sync `docs/ARCHITECTURE.md` with branch context layering
- [ ] Sync `docs/FLOWS.md` with branch detection and offline fallback flows
- [ ] Sync `docs/TESTING.md`, `docs/PRD.md`, and `docs/DESIGN.md`

