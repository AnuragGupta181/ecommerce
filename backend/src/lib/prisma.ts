import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient, type Prisma } from "../generated/prisma/client.js";

// Honour `?schema=` in the URL (used to isolate the integration-test schema).
const schema = new URL(env.DATABASE_URL).searchParams.get("schema") ?? undefined;
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL }, { schema });

export const prisma = new PrismaClient({
  adapter,
  // Serverless Postgres adds network latency per query; give multi-step transactions headroom.
  transactionOptions: { maxWait: 10_000, timeout: 20_000 },
});

/** Accepts both the root client and an interactive-transaction client. */
export type Db = Prisma.TransactionClient;
