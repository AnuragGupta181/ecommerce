# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## Project

**Haat** is a Flipkart-style e-commerce platform for a local business:

- `backend/`: Node.js, Express 5, TypeScript (ESM), Prisma 7, PostgreSQL (Neon). This is the **only** backend. Both clients use it.
- `frontend/`: Next.js 16 admin dashboard and inventory management. It uses a BFF pattern: SSR Server Components, Server Actions and httpOnly cookie sessions.
- `mobile/`: Expo (React Native) customer app with Expo Router.
- `docs/`: PRD, architecture, design, flows, API, database, testing and deployment. **Read [docs/PLAN.md](docs/PLAN.md) first.** It is the living task list. Tick tasks as you finish them.

## Commands

| Where | Command | Purpose |
|---|---|---|
| backend | `pnpm dev` | API with watch on :4000 |
| backend | `pnpm db:migrate` / `pnpm db:seed` | Prisma migrate (dev) / seed |
| backend | `pnpm test`, `pnpm typecheck`, `pnpm lint` | quality gates |
| frontend | `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint` | admin |
| mobile | `yarn start`, `yarn typecheck`, `yarn lint` | Expo app (add native deps with `npx expo install`) |
| root | `node --env-file=backend/.env tests/smoke/run.mjs` | end-to-end smoke against a running API (dev DB only) |

Use **pnpm** in `backend/` and `frontend/` (store kept in the repo-local `.pnpm-store/`), and **Yarn** in `mobile/`. Each app has its own `package.json` and lockfile.

## Rules

1. **Money is integer paise.** Never use floats for money. Format only at the edges (`formatINR`).
2. **Backend layering:** `*.routes.ts` (thin handlers) → `*.service.ts` → Prisma. Services throw `AppError`. Route handlers never call Prisma. Side effects such as notifications go through `inBackground()` after the transaction commits.
3. **Validate every input with Zod** in `*.schema.ts`. Inferred types are the source of truth.
4. **Multi-write business operations run in `prisma.$transaction`.** Notifications are sent *after* commit and must never throw into the caller.
5. **Pricing logic lives only in `backend/src/modules/pricing/pricing.ts`.** It is pure and unit tested. Clients display server-computed numbers. They never compute totals themselves.
6. **Order status changes go through `order-status.ts`** (the transition table). Do not set `order.status` directly anywhere else.
7. **Admin (Next.js):**
   - All backend calls go through `lib/server/api.ts` (`server-only`).
   - Mutations are Server Actions that re-check the session.
   - Request-time data sits behind `<Suspense>`, because `cacheComponents` is on.
   - Read `frontend/node_modules/next/dist/docs/` before using unfamiliar Next 16 APIs. Your training data may be outdated.
8. **Mobile:**
   - Code lives under `mobile/src/`: routes in `src/app/`, everything else outside it.
   - Server state uses React Query hooks in `src/hooks/`.
   - Session state uses the Zustand store in `src/lib/auth-store.ts`.
   - Guest-protected actions go through `useRequireAuth().guard(...)`.
9. **Design:**
   - Follow [docs/DESIGN.md](docs/DESIGN.md): yellow `#FFC727` and white with ink `#1C1A14`.
   - Never put white text on yellow.
   - No gradients, glassmorphism or emoji decoration.
10. **Secrets** live only in `.env` files, which are gitignored. Never commit or print credentials. Update `.env.example` when adding variables.
11. **Code style:**
    - Small focused files, named exports, no default exports except where frameworks require them.
    - No `any`.
    - Comments explain *why*, not *what*.
12. **Keep docs in sync.** When you add an endpoint, update [docs/API.md](docs/API.md). When you change the schema, update [docs/DATABASE.md](docs/DATABASE.md).
