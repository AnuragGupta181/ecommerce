# Deployment

## 0. Live (Vercel)

| What | URL | Vercel project | Root |
|---|---|---|---|
| API | https://haat-api.vercel.app/api/v1 (health: `/api/v1/health`) | `haat-api` | `backend/` (`api/index.ts`, `vercel.json` with the daily cron) |
| Admin and shop portal | https://haat-portal.vercel.app (shops: `/vendor`, sign-up: `/vendor/signup`) | `haat-portal` | `frontend/` |
| Customer app, web build | https://haat-app.vercel.app | `haat-app` | `mobile/` (`vercel.json`: Yarn 4 via corepack, `expo export --platform web`, SPA rewrite) |

The live API uses the seeded **development** database, so the logins in [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md) work there. Point `DATABASE_URL` at a fresh production database (and do not run the demo seed) before real customers use it.

- **Redeploy:** `npx vercel deploy --prod` from each root. Environment variables live in each Vercel project (never in git): the API needs the keys in `backend/.env.example` with `NODE_ENV=production`, `PUBLIC_URL`, `PORTAL_URL` and `CORS_ORIGINS` (the portal and app origins); the portal needs `API_URL`; the app needs `EXPO_PUBLIC_API_URL` and `ENABLE_EXPERIMENTAL_COREPACK=1`.
- **Region:** the API and the portal run in `sin1` (Singapore, `regions` in each `vercel.json`), next to the Neon database in `ap-southeast-1`. Every query is a network round trip, so a function in another region (Vercel's default is `iad1`, Washington) adds roughly 200 ms per query. Keep the functions in the database's region if either moves.
- **Same-origin API for the web app:** `mobile/vercel.json` rewrites `/api/*` to the API, and the app's `EXPO_PUBLIC_API_URL` is `https://haat-app.vercel.app/api/v1`. Browser calls are then same-origin and need no CORS preflight. Other origins still get CORS, with preflights cached for 2 hours.
- **Edge caching:** `/categories` and `/settings` are identical for everyone and send `s-maxage=300`, so the CDN answers them. Admin changes to categories or settings can take up to 5 minutes to show in the apps.
- **Web build of the app:** sessions use `localStorage` on web (the keychain on phones, `src/lib/secure-storage.ts`); voice search is phone-only.
- **Later on Render / AWS:** the same API runs as a long-lived server (`pnpm build && node dist/server.js`); set `ENABLE_SCHEDULER=true` or call `/api/v1/cron/daily` from a cron, and choose `STORAGE_DRIVER=s3` if wanted (docs/MARKETPLACE.md §14).

## 1. Topology

| Component | Recommended host | Alternative |
|---|---|---|
| PostgreSQL | **Neon** (serverless Postgres, branching for test/preview) | RDS, Supabase |
| Backend API | Render / Railway / Fly.io (Docker) | EC2 + Docker, ECS Fargate |
| Admin dashboard | **Vercel** | Docker on the same host as the API |
| Mobile app | **EAS Build** → Play Store / App Store, EAS Update for OTA JS updates | — |
| Email | Any SMTP (Brevo, SES, Postmark, Gmail app password for very small volume) | — |
| WhatsApp | Meta WhatsApp Cloud API (approved templates) or Twilio WhatsApp | `log` provider + manual `wa.me` links |
| Images | Local disk volume (small stores) | S3 / Cloudflare R2 (storage driver interface) |

```
             ┌──────────── Vercel ────────────┐
Admin user ─►│ Next.js (SSR + Server Actions) │──┐
             └────────────────────────────────┘  │ HTTPS + Bearer
Mobile app ──────────────────────────────────────┼─► API (Docker, 1+ instances) ─► Neon (pooled URL)
                                                 │        │
                                                 │        ├─► SMTP
                                                 │        └─► WhatsApp API
```

## 2. Environment variables

### Backend (`backend/.env`, see `.env.example`)

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | Neon **pooled** URL (`-pooler` host). Used at runtime |
| `DIRECT_URL` | Neon **direct** URL. Used by `prisma migrate deploy` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 64+ random chars each, different values |
| `CORS_ORIGINS` | comma list, e.g. `https://admin.haat.in` |
| `PUBLIC_URL` | public API base, used for uploaded image URLs |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | email |
| `WHATSAPP_PROVIDER` | `meta` \| `twilio` \| `log` |
| `WHATSAPP_META_TOKEN`, `WHATSAPP_META_PHONE_ID` | if `meta` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | if `twilio` |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` | first admin created by seed |

### Admin (`frontend/.env.local`)

| Variable | Notes |
|---|---|
| `API_URL` | server-side base URL of the API, e.g. `https://api.haat.in/api/v1` |
| `NEXT_PUBLIC_API_ORIGIN` | used only for `next/image` remote patterns |

### Mobile (`mobile/.env`)

| Variable | Notes |
|---|---|
| `EXPO_PUBLIC_API_URL` | e.g. `https://api.haat.in/api/v1`. In dev use your LAN IP: `http://192.168.x.x:4000/api/v1` |

## 3. Release steps

### Backend

```bash
cd backend
pnpm install --frozen-lockfile
pnpm prisma migrate deploy     # uses DIRECT_URL
pnpm build
node dist/server.js
# or: docker build -t haat-api . && docker run --env-file .env -p 4000:4000 haat-api
```

Run `pnpm db:seed` once to create the admin user and the default settings.

### Admin

```bash
cd frontend
pnpm build && pnpm start        # or push to Vercel with env vars set
```

### Mobile

```bash
cd mobile
npx eas build --profile production --platform android
npx eas submit --platform android
npx eas update --branch production   # JS-only hotfixes
```

## 4. Security checklist

- [ ] Strong unique JWT secrets, rotated on compromise
- [ ] `CORS_ORIGINS` restricted to the admin domain. The mobile app does not need CORS.
- [ ] HTTPS everywhere. Admin cookies are `Secure`, `HttpOnly` and `SameSite=Lax`.
- [ ] Neon role with least privilege and the password rotated after it has been shared in any chat or ticket
- [ ] Rate limiting on `/auth/*`
- [ ] Upload size and type limits (images only, 5 MB)
- [ ] `helmet` enabled, `x-powered-by` disabled
- [ ] Database backups. Neon point-in-time restore is enabled.
- [ ] Logs do not contain passwords, tokens or OTPs (pino redaction configured)

## 5. Scaling notes

- The API is stateless, so add instances behind a load balancer.
- Use Neon's pooled connection string for the app. Keep Prisma's pool small per instance (`connection_limit`).
- Move notification sending to a queue (BullMQ + Redis) when volume grows. The `notify` service is already isolated behind one interface.
