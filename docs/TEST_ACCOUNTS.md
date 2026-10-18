# Test accounts

`pnpm db:seed` (in `backend/`) creates these accounts on a **development** database, together with the data listed next to each one. Seeding writes straight to the database and sends no emails.

**Live:** portal https://haat-portal.vercel.app · app (web) https://haat-app.vercel.app · API https://haat-api.vercel.app/api/v1

## Logins

| Account | Login | Password |
|---|---|---|
| Super admin (dev database) | `admin@haat.local` | `Admin@12345` |
| Test super admin | `superadmin.test@haat.local` | `Haat@Test123` |
| Admin (support) | `admin.support@haat.local` | `Haat@Test123` |
| Vendor owner: Sharma Dairy & Kirana | `vendor.sharma@haat.local` | `Haat@Test123` |
| Vendor staff: Sharma Dairy & Kirana | `vendor.sharma.staff@haat.local` | `Haat@Test123` |
| Vendor owner: Green Basket | `vendor.green@haat.local` | `Haat@Test123` |
| Vendor owner: New Corner Store (pending) | `vendor.corner@haat.local` | `Haat@Test123` |
| Customer: Priya Nair | `customer.priya@haat.local` or `+919700000003` | `Haat@Test123` |
| Customer: Rahul Verma | `customer.rahul@haat.local` or `+919700000004` | `Haat@Test123` |

The super admin comes from `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` in `backend/.env`. Every other account uses the shared test password `Haat@Test123` (`TEST_ACCOUNT_PASSWORD` in `backend/prisma/seed-demo.ts`). Re-running the seed resets them to it.

> **This repository is public.** Anyone can read these logins. Change the super admin password, and do not seed these accounts, before any database holds real customers.


## Platform

| Role | Login | What to try |
|---|---|---|
| Super admin | `admin@haat.local` (or the test super admin) | Everything, plus **Admins** (create or remove admin accounts) and the **audit log** |
| Admin (support) | `admin.support@haat.local` | Vendors (approve **New Corner Store**, which is pending), all orders, read-only inventory per vendor, tickets (the major "Voice search does not start" ticket), payouts, platform report |

## Vendors (Next.js portal, `/vendor`)

| Shop | Login | Location | What to try |
|---|---|---|---|
| Sharma Dairy & Kirana (approved, 8% commission) | `vendor.sharma@haat.local` (owner) | Hebbal, Bengaluru | Today's milk deliveries (Priya), a confirmed order to pack, the minor ticket about a leaking curd packet, a chat thread, a counter bill, plans "Morning milk" and "Daily curd" |
| Sharma Dairy & Kirana | `vendor.sharma.staff@haat.local` (staff) | | Same shop as staff: cannot add or remove staff |
| Green Basket (approved, 10%) | `vendor.green@haat.local` | Banashankari, Bengaluru | A new order from Rahul to confirm, Rahul's upcoming weekly tomato subscription, a chat thread |
| New Corner Store (pending) | `vendor.corner@haat.local` | Indiranagar, Bengaluru | Waiting for approval: can set up stock, invisible to customers |
| Haat Store (platform shop) | none; managed by the admin | MG Road, Bengaluru | The full catalog, so every product has at least one shop |

## Customers (mobile app)

| Customer | Login | Home | What to try |
|---|---|---|---|
| Priya Nair | `customer.priya@haat.local` / `+919700000003` | Hebbal, next to Sharma Dairy | A delivered order (review, return, invoice PDF), a confirmed order, a monthly milk subscription 10 days in (one missed drop, ₹200 paid; try skipping or pausing days), her ticket with the shop's reply, chat with Sharma Dairy, 40 coins |
| Rahul Verma | `customer.rahul@haat.local` / `+919700000004` | Banashankari, next to Green Basket | A placed order, a weekly tomato plan starting in 2 days, tomatoes in his cart, an app-bug ticket |

## Delivery partner

**Mohan (milk)** delivers Priya's milk. In the vendor portal, open Riders and use **Send schedule link** to get his private `/r/<token>` page, which shows today's drops and the month ahead.

## Location for testing

The seeded shops are in Bengaluru, so set the app's location there:
- **Hebbal:** `13.035, 77.597`. Sharma Dairy is nearest.
- **Banashankari:** `12.935, 77.555`. Green Basket is nearest.

The smoke test (`tests/smoke/run.mjs`) browses from Hebbal and runs the full order flow as a fresh customer, Sharma Dairy and the admin.
