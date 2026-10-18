import dns from "node:dns";
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";


if (existsSync(".env")) process.loadEnvFile(".env");

// Same DNS order as the app (see src/lib/prisma.ts) for migrate and studio.
const dnsOrder = process.env.DB_DNS_ORDER;
if (dnsOrder === "ipv4first" || dnsOrder === "ipv6first" || dnsOrder === "verbatim") dns.setDefaultResultOrder(dnsOrder);

// Migrations must use Neon's direct (non-pooled) connection; runtime uses the pooled URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
