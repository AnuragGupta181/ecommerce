# Testing Strategy

## 1. Pyramid

| Level | Tool | Scope | Location |
|---|---|---|---|
| Unit | Vitest | Pure logic: pricing engine, coupon rules, coin math, order status machine, slug/money helpers | `backend/tests/unit` |
| Integration | Vitest + Supertest | HTTP → service → real Postgres: auth, catalog, cart → order, cancel, rider assignment | `backend/tests/integration` |
| Static | `tsc --noEmit`, ESLint | All three apps | each app |
| Smoke / E2E | Node script against a running API | Happy path: register → browse → cart → order → admin assign rider → deliver | `tests/smoke` |
| Manual | Checklist below | Mobile UX on Android/iOS, admin flows | — |

## 2. Running

```bash
# backend
cd backend
pnpm test            # all tests
pnpm test:unit       # unit only, no DB needed
pnpm test:int        # integration, needs TEST_DATABASE_URL
pnpm typecheck && pnpm lint

# admin
cd frontend && pnpm typecheck && pnpm lint && pnpm build

# mobile
cd mobile && yarn typecheck && yarn lint

# smoke (API must be running and seeded)
node tests/smoke/run.mjs
```

## 3. Test database

Integration tests use `TEST_DATABASE_URL`. **Never point it at production.** Two options:

- A **Neon branch** created from the main branch, e.g. `test`. It is cheap and isolated.
- Local Postgres from `docker compose up -d postgres`: `postgresql://haat:haat@localhost:5432/haat_test`.

The suite runs `prisma migrate reset --force` against that URL before the run (see `tests/setup/global-setup.ts`). Each test file creates its own users and products with unique suffixes, so files can run in sequence without cross-talk.

## 4. What must always be covered

- The pricing engine handles every combination: no coupon, percent with cap, flat, below the min order, coins cap, the free-delivery threshold, and a coupon combined with coins.
- Order placement is atomic. When stock is insufficient for one line, nothing is written.
- Stock is restored on cancel and on return.
- Coupon per-user and total limits are enforced.
- Coins are credited only on DELIVERED and reversed on RETURNED.
- Illegal status transitions are rejected.
- Assigning an inactive or unknown rider is rejected. A valid assignment writes NotificationLog rows.
- Guest calls to protected endpoints return 401. A customer calling admin endpoints gets 403.

## 5. Manual QA checklist (release)

- [ ] Fresh install: splash → onboarding → home as guest
- [ ] Guest taps Add to cart → login sheet → after login the item is in the cart
- [ ] Search suggestions, filters and sort combinations
- [ ] Product with variants: switching variant updates the price, MRP and stock
- [ ] Coupon apply and remove, invalid coupon message
- [ ] Coins toggle shows the correct deduction and cap
- [ ] Place a COD order and see the success screen and order in the list
- [ ] Admin: confirm → pack → assign rider → the customer gets email/WhatsApp, the rider's name and phone show in the app
- [ ] Mark delivered → coins credited in the app
- [ ] Cancel flow restores stock (check the admin inventory)
- [ ] Return flow
- [ ] Admin CRUD for every entity; image upload
- [ ] Android back button behaviour, keyboard avoiding on forms, small screens (360 dp)
