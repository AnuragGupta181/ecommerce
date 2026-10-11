# Haat — Master Build Plan

> Living document. Every task is ticked as soon as it is finished and verified.
> Last updated: 2026-10-11. Backend complete. Admin dashboard built (not yet exercised against a running API). Mobile screens next.

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

## Phase 5 — Mobile app (Expo / React Native)

- [x] Expo SDK 57 + expo-router + TypeScript scaffold (yarn, `src/` layout, route placeholders)
- [x] Theme tokens and floating bottom pill navigation
- [~] UI kit: Screen, Text, PlaceholderScreen done; Button, Input, ProductCard and others to do
- [ ] First run on an Android emulator / Expo Go (verify fonts, splash, pill tab bar, API reachability via LAN IP)
- [ ] Splash screen + onboarding
- [x] API client (single-flight token refresh), React Query, auth store (SecureStore)
- [~] Auth gate for protected actions: `useRequireAuth` routes guests to login; login sheet and resume-after-login to do
- [ ] Login / signup / forgot password
- [ ] Home: search bar, banners carousel, categories strip, deals, recommended
- [ ] Categories screen, product listing with filters & sort
- [ ] Search with suggestions & recent searches
- [ ] Product detail: gallery, variants, price breakup, offers, reviews, similar products
- [ ] Wishlist
- [ ] Cart with price details, coupon apply, coins toggle
- [ ] Checkout: address select/add, payment method, place order, success screen
- [ ] Orders list + order detail (status timeline, rider name & phone, cancel, return)
- [ ] Account: profile, addresses, coins history, coupons, notifications, help, logout
- [ ] Write review flow

## Phase 6 — Quality

- [x] Backend unit tests (pricing engine, order status machine)
- [x] Backend integration tests (auth, catalog/inventory, cart → order → rider → delivery, cancel)
- [ ] Admin type-check + lint + build
- [ ] Mobile type-check + lint
- [ ] Root `tests/` end-to-end smoke script
- [ ] Add `.gitattributes` to normalise line endings (LF in repo; silences CRLF warnings on Windows)

## Phase 7 — Deployment

- [ ] Backend Dockerfile + production compose
- [ ] Admin Dockerfile / Vercel notes
- [ ] EAS build profiles for mobile
- [ ] GitHub Actions CI (lint, type-check, test)
