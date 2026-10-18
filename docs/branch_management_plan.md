> **Superseded** by [MARKETPLACE.md](MARKETPLACE.md) (vendors own branches). The branch tables described here are reused; track work in [PLAN.md](PLAN.md) Phases 8–14.

# Branch & Vendor Management System — Implementation Plan

> **Scope:** Production-grade multi-branch system for Haat.
> Four pillars: (1) geolocation-aware nearest-branch selection, (2) isolated per-branch inventory, (3) real-time branch-scoped catalog on mobile, (4) per-branch operational status with order fallback.
> All existing code, docs, and tests must be updated in step with each phase.

---

## Design principles (non-negotiable)

| Rule | Rationale |
|---|---|
| Money is integer paise | Existing rule; never float |
| No white text on yellow | Design system rule |
| No gradients, glassmorphism, emoji decoration | Design system rule |
| Branch context travels as `X-Branch-Id` header (or `?branchId=` fallback) | Single, auditable chokepoint; no cookie leakage between tabs |
| Backend is the single source of truth | Clients display server-computed numbers |
| Per-branch stock is isolated; global `ProductVariant.stock` kept as fallback during transition | Every branch stock mutation goes through `BranchVariantStock` |
| Offline branch falls back in a deterministic order | No silent order loss |
| All multi-write ops run inside `prisma.$transaction` | Existing rule |
| Services throw `AppError`; route handlers never call Prisma | Existing rule |

---

## Phase 0 — Pre-work: Audit & baseline

**Goal:** Verify the current test suite is green before any schema changes.

### Tasks

- [ ] **P0.1** Run `pnpm test`, `pnpm typecheck`, `pnpm lint` in `backend/`; confirm all pass.
- [ ] **P0.2** Run `node --env-file=backend/.env tests/smoke/run.mjs`; confirm all 42 checks pass.
- [ ] **P0.3** Run `pnpm typecheck && pnpm lint` in `frontend/`.
- [ ] **P0.4** Run `yarn typecheck && yarn lint` in `mobile/`.
- [ ] **P0.5** Note any pre-existing failures in a scratch file; do not proceed if any exist.

**Exit criteria:** Zero failing tests, zero type errors, zero lint errors.

---

## Phase 1 — Database: Branch schema

**Goal:** Add the `Branch` model and per-branch stock layer without breaking existing data.

### 1.1 New Prisma models (to be merged into `backend/prisma/schema.prisma`)

```prisma
model Branch {
  id               String   @id @default(cuid())
  name             String
  slug             String   @unique
  address          String
  city             String
  state            String
  pincode          String
  lat              Float    // decimal degrees
  lng              Float    // decimal degrees
  deliveryRadiusKm Float    @default(5)
  phone            String?
  email            String?
  isActive         Boolean  @default(true)
  isOnline         Boolean  @default(true)  // operational toggle
  offlineMessage   String?  // e.g. "Back at 9 AM"
  sortOrder        Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  branchStock  BranchVariantStock[]
  orders       Order[]
  riders       BranchRider[]
  statusLogs   BranchStatusLog[]

  @@index([isActive, isOnline])
  @@index([lat, lng])
}

model BranchVariantStock {
  id                String   @id @default(cuid())
  branchId          String
  variantId         String
  stock             Int      @default(0)
  lowStockThreshold Int      @default(5)
  isAvailable       Boolean  @default(true)  // admin can hide variant from this branch
  updatedAt         DateTime @updatedAt

  branch         Branch          @relation(fields: [branchId], references: [id], onDelete: Cascade)
  variant        ProductVariant  @relation(fields: [variantId], references: [id], onDelete: Cascade)
  stockMovements BranchStockMovement[]

  @@unique([branchId, variantId])
  @@index([branchId, stock])
  @@index([variantId])
}

model BranchStockMovement {
  id            String            @id @default(cuid())
  branchStockId String
  type          StockMovementType // reuses existing enum
  quantity      Int
  stockAfter    Int
  reason        String?
  orderId       String?
  createdById   String?
  createdAt     DateTime          @default(now())

  branchStock BranchVariantStock @relation(fields: [branchStockId], references: [id], onDelete: Cascade)

  @@index([branchStockId, createdAt])
  @@index([orderId])
}

// Riders assigned to branches (many-to-many)
model BranchRider {
  branchId String
  riderId  String

  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  rider  Rider  @relation(fields: [riderId], references: [id], onDelete: Cascade)

  @@id([branchId, riderId])
}

model BranchStatusLog {
  id        String   @id @default(cuid())
  branchId  String
  isOnline  Boolean
  reason    String?
  actorId   String?
  createdAt DateTime @default(now())

  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@index([branchId, createdAt])
}
```

### 1.2 Foreign-key additions to existing models

```prisma
// Order — add optional branchId
model Order {
  // ... existing fields ...
  branchId String?
  branch   Branch? @relation(fields: [branchId], references: [id], onDelete: SetNull)
}

// Rider — add back-relation for BranchRider
model Rider {
  // ... existing fields ...
  branches BranchRider[]
}
```

### 1.3 Migration strategy

1. `pnpm db:migrate --name add_branches` — creates and applies the migration.
2. `ProductVariant.stock` stays; a data migration script (`backend/prisma/populate-branch-stock.ts`) copies existing stock into a "Main" branch's `BranchVariantStock` rows.
3. Inventory APIs will also update `ProductVariant.stock` as a global sum for backwards-compat with existing reports and the smoke test; this sync can be removed after Phase 6.

### 1.4 Seed additions

Add 3 branches (Main / North / South) with realistic lat/lng and delivery radii. Seed `BranchVariantStock` rows for every active variant across all branches.

### Tasks

- [ ] **P1.1** Add all new models to `schema.prisma`.
- [ ] **P1.2** Add `branchId` FK to `Order`; add `branches` relation to `Rider`.
- [ ] **P1.3** `pnpm db:migrate --name add_branches`.
- [ ] **P1.4** Write `backend/prisma/populate-branch-stock.ts` data migration script.
- [ ] **P1.5** Update `backend/prisma/seed.ts`: 3 branches + `BranchVariantStock` for all active variants.
- [ ] **P1.6** `pnpm db:seed`; verify in Prisma Studio.
- [ ] **P1.7** Update `docs/DATABASE.md` with all new tables.

**Exit criteria:** `pnpm db:migrate` + `pnpm db:seed` succeed; Prisma generates without errors; `pnpm test:unit` still passes.

---

## Phase 2 — Backend: Branch module (CRUD + geo-detection)

**Goal:** Expose `/branches` public API and `/admin/branches` admin API.

### 2.1 Module file layout

```
backend/src/modules/branches/
  branch.routes.ts      public + admin sub-routers
  branch.schema.ts      Zod schemas
  branch.service.ts     business logic
  branch.presenter.ts   response shapes
```

### 2.2 Public API (`/api/v1/branches`)

| Method | Path | Auth | Query / Notes |
|---|---|---|---|
| GET | `/branches` | 🌐 | `lat`, `lng`, `limit?` → sorted by distance; each item has `distanceKm`, `isWithinRadius` |
| GET | `/branches/:id` | 🌐 | Branch detail |
| GET | `/branches/nearest` | 🌐 | `lat`, `lng` → single nearest **online** branch |

### 2.3 Admin API (`/api/v1/admin/branches`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/branches` | List with `orderCount`, `totalStock`, `isOnline` |
| POST | `/admin/branches` | Create |
| GET/PATCH/DELETE | `/admin/branches/:id` | Detail / update / deactivate (if has orders) |
| PATCH | `/admin/branches/:id/online` | `{ isOnline, reason? }` — writes `BranchStatusLog` |
| GET | `/admin/branches/:id/riders` | Riders assigned to this branch |
| POST | `/admin/branches/:id/riders` | `{ riderId }` |
| DELETE | `/admin/branches/:id/riders/:riderId` | Unassign |

### 2.4 Geo-detection algorithm (`branch.service.ts`)

```typescript
// Pure function — no external library; accurate for delivery-radius distances
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number

// Branches sorted by distance from the given point (inactive filtered out)
export async function listBranchesByDistance(lat: number, lng: number, limit?: number)

// Nearest online branch that covers the point; falls back to nearest online if none covers it
export async function findNearestBranch(lat: number, lng: number): Promise<Branch>
```

### 2.5 Online/Offline toggle

```typescript
export async function setBranchOnlineStatus(
  branchId: string,
  isOnline: boolean,
  reason: string | undefined,
  actorId: string
): Promise<Branch>
// Writes BranchStatusLog row in the same transaction.
```

### 2.6 Order assignment fallback

```typescript
/**
 * Resolves the branchId for an order.
 * Priority:
 *   1. Customer's preferred branch (if online + active)
 *   2. Nearest online branch to the delivery address
 *   3. Any online branch (last resort, logs a warning)
 * Throws AppError 503 if no branch is online.
 */
export async function resolveBranchForOrder(
  preferredBranchId: string | undefined,
  lat: number,
  lng: number
): Promise<string>
```

### Tasks

- [ ] **P2.1** Create `branch.schema.ts`.
- [ ] **P2.2** Create `branch.service.ts` (haversine, list, nearest, toggle, resolve).
- [ ] **P2.3** Create `branch.presenter.ts`.
- [ ] **P2.4** Create `branch.routes.ts`; mount in `app.ts`.
- [ ] **P2.5** Unit-test `haversineKm` and `resolveBranchForOrder` in `backend/tests/unit/branch.test.ts`.
- [ ] **P2.6** Integration-test public endpoints in `backend/tests/integration/branch.test.ts`.
- [ ] **P2.7** Update `docs/API.md` with all new endpoints.

**Exit criteria:** All new + existing tests pass; `pnpm typecheck` clean.

---

## Phase 3 — Backend: Branch-scoped inventory

**Goal:** Isolate stock per branch; checkout and catalog read from `BranchVariantStock`.

### 3.1 Branch context middleware

```typescript
// backend/src/middleware/branch-context.ts
// Reads X-Branch-Id header or ?branchId= query param.
// Attaches req.branchId?: string. Does NOT throw if missing.
export function extractBranchContext(): RequestHandler
```

### 3.2 Branch inventory admin endpoints (added to `inventory.routes.ts`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/inventory/branches/:branchId` | Variant stock table for this branch |
| GET | `/admin/inventory/branches/:branchId/summary` | `{ lowStock, outOfStock, totalUnits }` |
| POST | `/admin/inventory/branches/:branchId/variants/:variantId/adjust` | `{ mode, quantity, reason }` |
| PATCH | `/admin/inventory/branches/:branchId/variants/:variantId/threshold` | `{ lowStockThreshold }` |
| PATCH | `/admin/inventory/branches/:branchId/variants/:variantId/availability` | `{ isAvailable }` |
| GET | `/admin/inventory/branches/:branchId/variants/:variantId/movements` | `BranchStockMovement` log |

### 3.3 `applyBranchStockChange()`

```typescript
// Addition to inventory.service.ts
export async function applyBranchStockChange(
  db: Db,
  branchId: string,
  variantId: string,
  delta: number,
  type: StockMovementType,
  opts?: { reason?: string; orderId?: string; actorId?: string }
): Promise<void>
// Throws OUT_OF_STOCK if stock < |delta|. Writes BranchStockMovement in same tx.
```

### 3.4 Checkout integration (`orders.service.ts`)

1. Accept `branchId` in the checkout body (Zod schema updated).
2. Decrement `BranchVariantStock.stock` inside the order transaction.
3. Store `branchId` on the `Order` record.
4. Cancel/return restores `BranchVariantStock.stock`.

### 3.5 Catalog stock display (`products.service.ts`)

Accept optional `branchId`. When present, join `BranchVariantStock` for the `stock` field. Fallback to `ProductVariant.stock` when absent (guest / admin view).

### Tasks

- [ ] **P3.1** Create `middleware/branch-context.ts`.
- [ ] **P3.2** Add `applyBranchStockChange()` to `inventory.service.ts`.
- [ ] **P3.3** Add branch inventory routes to `inventory.routes.ts`.
- [ ] **P3.4** Refactor `orders.service.ts`: use branch stock at checkout.
- [ ] **P3.5** Refactor `orders.service.ts`: restore branch stock on cancel/return.
- [ ] **P3.6** Refactor `products.service.ts`: branch-scoped stock when `branchId` present.
- [ ] **P3.7** Add `branchId` to `orders.schema.ts`.
- [ ] **P3.8** Unit-test `applyBranchStockChange` in `backend/tests/unit/branch-inventory.test.ts`.
- [ ] **P3.9** Integration-test branch checkout in `backend/tests/integration/branch-order.test.ts`.
- [ ] **P3.10** Update `docs/DATABASE.md` and `docs/FLOWS.md` (§4, §8).

**Exit criteria:** Order placement decrements branch stock; cancel restores it; product detail shows branch-scoped stock.

---

## Phase 4 — Admin dashboard: Branch management UI

**Goal:** Admin can CRUD branches, toggle online/offline, and manage per-branch inventory.

### 4.1 New Next.js pages

```
frontend/app/(dashboard)/
  branches/
    page.tsx                  Branch list table
    new/page.tsx              Create branch form
    [id]/
      page.tsx                Branch detail + online toggle
      edit/page.tsx           Edit form
      inventory/page.tsx      Per-branch inventory (BranchVariantStock)
      riders/page.tsx         Riders assigned to this branch
```

### 4.2 New components

| Component | Purpose |
|---|---|
| `BranchStatusBadge` | Ink/yellow badge: Online / Offline |
| `OnlineToggle` | Switch + confirmation dialog + optional reason input |
| `BranchInventoryTable` | Existing `InventoryTable` scoped to a branch |

### 4.3 Server Actions (`frontend/lib/server/branches.actions.ts`)

```typescript
export async function createBranch(fd: FormData)
export async function updateBranch(id: string, fd: FormData)
export async function deleteBranch(id: string)
export async function setBranchOnline(id: string, isOnline: boolean, reason?: string)
export async function assignRiderToBranch(branchId: string, riderId: string)
export async function unassignRiderFromBranch(branchId: string, riderId: string)
```

### 4.4 Other admin UI changes

- **Sidebar**: add "Branches" between Riders and Customers.
- **Order detail**: show branch name; filter rider dropdown to the order's branch.
- **Dashboard**: add "Branch Status" widget with one-click online/offline toggle per branch.
- **Orders list**: add `branchId` filter dropdown.

### Tasks

- [ ] **P4.1** Add Branches to sidebar.
- [ ] **P4.2** Build `branches/page.tsx`.
- [ ] **P4.3** Build `branches/new/page.tsx`.
- [ ] **P4.4** Build `branches/[id]/page.tsx` (detail + `OnlineToggle`).
- [ ] **P4.5** Build `branches/[id]/edit/page.tsx`.
- [ ] **P4.6** Build `branches/[id]/inventory/page.tsx`.
- [ ] **P4.7** Build `branches/[id]/riders/page.tsx`.
- [ ] **P4.8** Create `lib/server/branches.actions.ts`.
- [ ] **P4.9** Update order detail: branch name + filtered rider dropdown.
- [ ] **P4.10** Add "Branch Status" widget to dashboard.
- [ ] **P4.11** Add branch filter to orders list.
- [ ] **P4.12** `pnpm typecheck && pnpm lint && pnpm build` — fix all errors.

**Exit criteria:** Admin can CRUD branches, toggle online/offline, manage per-branch inventory; build succeeds.

---

## Phase 5 — Mobile app: Branch-aware customer experience

**Goal:** Customer auto-detects nearest branch; can override; catalog and stock update in real time.

### 5.1 Branch store (Zustand + AsyncStorage)

```typescript
// mobile/src/lib/branch-store.ts
type BranchState = {
  selectedBranch: BranchSummary | null  // null = not yet resolved
  detectionMode: 'auto' | 'manual'
  setSelectedBranch: (branch: BranchSummary, mode: 'auto' | 'manual') => void
  clearBranch: () => void
}
// Persisted to AsyncStorage (key: 'branch')
```

### 5.2 Branch detection hook

```
App launch
  └─► useBranchDetection()
        ├─ expo-location permission granted?
        │    yes ─► getCurrentPositionAsync()
        │             ─► GET /api/v1/branches/nearest?lat&lng
        │             ─► branchStore.setSelectedBranch(branch, 'auto')
        │    no  ─► GET /api/v1/branches?limit=1
        │             ─► branchStore.setSelectedBranch(firstBranch, 'auto')
        └─► branch resolved; app renders normally
```

### 5.3 Branch selector UI components

| File | Purpose |
|---|---|
| `BranchIndicatorBar.tsx` | Below search bar on Home: branch name + tap-to-change |
| `BranchSelectorSheet.tsx` | Sheet listing all active branches by distance |
| `BranchOfflineBanner.tsx` | Warning strip when selected branch is offline |

**BranchOfflineBanner behaviour:**
- Background: `#FFC727` (yellow); text: `#1C1A14` (ink). No white text on yellow.
- "Change Branch" button opens `BranchSelectorSheet`.
- Checkout CTA disabled with "This branch is offline" tooltip.

### 5.4 API client injection

`mobile/src/lib/api.ts` injects `X-Branch-Id: <selectedBranch.id>` on every request when branch is set.

### 5.5 React Query hook changes

| Hook | Change |
|---|---|
| `useProducts` | Add `branchId` to query key + `?branchId=` |
| `useProductDetail` | Add `branchId` |
| `useCart` | Add `branchId` |
| New `useBranches` | `GET /branches?lat&lng` |
| New `useNearestBranch` | `GET /branches/nearest?lat&lng` |

### 5.6 Checkout modification

Before `POST /orders`: read `branchStore.selectedBranch`; if offline, re-resolve via `GET /branches/nearest` with the delivery address coordinates; include `branchId` in the order body.

### Tasks

- [ ] **P5.1** `npx expo install expo-location` in `mobile/`.
- [ ] **P5.2** Create `branch-store.ts`.
- [ ] **P5.3** Create `use-branch-detection.ts`.
- [ ] **P5.4** Create `use-branches.ts` (React Query hooks).
- [ ] **P5.5** Inject `X-Branch-Id` in `mobile/src/lib/api.ts`.
- [ ] **P5.6** Build `BranchIndicatorBar.tsx`.
- [ ] **P5.7** Build `BranchSelectorSheet.tsx`.
- [ ] **P5.8** Build `BranchOfflineBanner.tsx`.
- [ ] **P5.9** Integrate `BranchIndicatorBar` into Home screen.
- [ ] **P5.10** Wire `BranchOfflineBanner` (conditional on `isOnline`).
- [ ] **P5.11** Update all product/cart hooks with `branchId`.
- [ ] **P5.12** Update checkout flow with `branchId`.
- [ ] **P5.13** `yarn typecheck && yarn lint` — fix all errors.
- [ ] **P5.14** Update `docs/FLOWS.md` §1 with branch detection step.

**Exit criteria:** App auto-detects branch; user can override; stock is branch-scoped; checkout sends `branchId`.

---

## Phase 6 — Operational status: Online/offline + fallback

**Goal:** Graceful order handling when branches go offline.

### 6.1 Offline branch behaviour matrix

| Scenario | Behaviour |
|---|---|
| Branch goes offline, no in-flight orders | New orders blocked/rerouted; mobile shows offline banner |
| Branch goes offline, orders in PLACED/CONFIRMED/PACKED | Existing orders continue; admin sees warning |
| Customer places order to offline branch | `resolveBranchForOrder` silently routes to nearest online branch |
| ALL branches offline | `POST /orders` → `503 SERVICE_UNAVAILABLE` |

### 6.2 Customer notifications on branch offline

When `setBranchOnlineStatus` sets `isOnline = false`, after commit:
- Find orders in `PLACED/CONFIRMED/PACKED` assigned to this branch.
- Send each customer an in-app `SYSTEM` notification:
  > "Your order [orderNumber] is being handled by our nearest available branch."

### 6.3 Admin additions

- "Branch Status" widget on Dashboard (Phase 4 covers this).
- Branch filter on Orders list (Phase 4 covers this).

### Tasks

- [ ] **P6.1** Wire `resolveBranchForOrder` into `orders.service.ts` checkout path.
- [ ] **P6.2** Implement customer notifications in `setBranchOnlineStatus` (after commit, `inBackground`).
- [ ] **P6.3** Update `docs/FLOWS.md` with new §9 (Branch operational status).
- [ ] **P6.4** Update `docs/ARCHITECTURE.md` §3.2 (modules table) to include `branches`.

**Exit criteria:** Offline branch routes new orders to fallback; customers notified; all-offline returns 503.

---

## Phase 7 — Tests: Full coverage

**Goal:** Every new function, endpoint, and hook is covered.

### 7.1 Backend unit tests (`backend/tests/unit/`)

| File | Covers |
|---|---|
| `branch.test.ts` | `haversineKm` edge cases; `resolveBranchForOrder` with 0/1/N online branches |
| `branch-inventory.test.ts` | `applyBranchStockChange`: concurrent race, out-of-stock, SET mode |
| `branch-status.test.ts` | `setBranchOnlineStatus` audit log; idempotent toggle |

### 7.2 Backend integration tests (`backend/tests/integration/`)

| File | Covers |
|---|---|
| `branch.test.ts` | CRUD; geo-sort; auth guards |
| `branch-order.test.ts` | Checkout with `branchId`; stock decremented; cancel restores; offline → fallback |
| `branch-inventory.test.ts` | Per-branch inventory CRUD; threshold; availability toggle |

### 7.3 Mobile unit tests (`mobile/tests/`)

| File | Covers |
|---|---|
| `branch-detection.test.ts` | Permission granted → nearest branch; denied → first branch; null coords → fallback |
| `branch-store.test.ts` | Zustand store: set/clear, persistence, mode |

### 7.4 Smoke test additions (`tests/smoke/run.mjs`)

1. List branches (expect ≥1 online).
2. Get nearest branch with synthetic lat/lng.
3. Place order with `branchId`; verify `BranchVariantStock` decremented.
4. Toggle branch offline; place another order; verify fallback branch used.
5. Toggle branch back online.

### Tasks

- [ ] **P7.1** `backend/tests/unit/branch.test.ts`
- [ ] **P7.2** `backend/tests/unit/branch-inventory.test.ts`
- [ ] **P7.3** `backend/tests/unit/branch-status.test.ts`
- [ ] **P7.4** `backend/tests/integration/branch.test.ts`
- [ ] **P7.5** `backend/tests/integration/branch-order.test.ts`
- [ ] **P7.6** `backend/tests/integration/branch-inventory.test.ts`
- [ ] **P7.7** `mobile/tests/branch-detection.test.ts`
- [ ] **P7.8** `mobile/tests/branch-store.test.ts`
- [ ] **P7.9** Update `tests/smoke/run.mjs`.
- [ ] **P7.10** Update `docs/TESTING.md` (branch coverage section + manual QA checklist).
- [ ] **P7.11** Run full suite; fix all failures.

**Exit criteria:** `pnpm test`, `yarn test`, and smoke test all pass with zero failures.

---

## Phase 8 — Documentation sync

**Goal:** All docs reflect the branch system end-to-end.

| File | What changes |
|---|---|
| `docs/PLAN.md` | Add Phase 9 (Branch); tick each completed task |
| `docs/DATABASE.md` | Branch, BranchVariantStock, BranchStockMovement, BranchRider, BranchStatusLog |
| `docs/API.md` | All new branch endpoints (public + admin) |
| `docs/ARCHITECTURE.md` | System diagram (branch middleware); module table; data model |
| `docs/FLOWS.md` | §1 updated launch flow; §4 updated purchase; §8 updated inventory; new §9 branch status |
| `docs/TESTING.md` | Branch coverage section; updated QA checklist |
| `docs/PRD.md` | New §5.7 Branch management |
| `docs/DESIGN.md` | BranchIndicatorBar, BranchSelectorSheet, BranchOfflineBanner specs |
| `AGENTS.md` | Add `branches` to the module rules list |

### Tasks

- [ ] **P8.1–P8.9** Update each file listed above.

---

## Execution order

```
P0 (baseline audit)
  → P1 (DB schema + seed)
  → P2 (branch module + geo API)
  → P3 (branch-scoped inventory + checkout)
  → P4 (admin UI)
  → P5 (mobile)
  → P6 (offline fallback)
  → P7 (full tests)
  → P8 (docs sync)
```

Run `pnpm test && pnpm typecheck && pnpm lint` (backend) and `pnpm typecheck && pnpm lint && pnpm build` (frontend) after **every phase**. Do not move to the next phase until the exit criteria are met.

---

## Key design decisions

| Decision | Rationale |
|---|---|
| `BranchVariantStock` as a separate table | Enables N branches with no schema change per branch; each branch's stock is independently auditable |
| Branch context via `X-Branch-Id` header | Single auditable injection point; no cookie pollution; works from mobile and admin |
| Pure TypeScript Haversine (no PostGIS) | Neon free tier has no PostGIS; pure function is unit-testable; accurate enough for 5–20 km radii |
| `resolveBranchForOrder` lives on the backend | Clients cannot be trusted to enforce fallback policy |
| `ProductVariant.stock` kept as global during transition | Avoids breaking existing smoke test, pricing engine, and admin summary in one go |
| `expo-location` for geolocation | Native Expo module; consistent with voice-search pattern |
| Branch state in Zustand + AsyncStorage | Mirrors the existing `auth-store` + `device-store` pattern; survives app restart |

---

## Overall exit criteria

- All tests green (`pnpm test`, `yarn test`, smoke script).
- Zero type errors, zero lint errors across all three apps.
- Admin can create a branch, toggle it offline, and see orders routed to the fallback branch.
- Mobile auto-detects branch on launch, allows manual override, shows offline warning, and sends the correct `branchId` at checkout.
- All docs updated and consistent with the implementation.
