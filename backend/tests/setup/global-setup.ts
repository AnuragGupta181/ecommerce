import { execSync } from "node:child_process";
import pg from "pg";

/** Migrates the isolated test schema and wipes all rows before the run. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("TEST_DATABASE_URL not set: integration tests will fail, unit tests still run.");
    return;
  }
  if (!new URL(url).searchParams.get("schema")) {
    throw new Error("TEST_DATABASE_URL must include ?schema=<name> so tests never touch the public schema");
  }

  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DIRECT_URL: url, DATABASE_URL: url },
  });

  const schema = new URL(url).searchParams.get("schema") as string;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename <> '_prisma_migrations'",
    [schema],
  );
  if (rows.length > 0) {
    const tables = rows.map((row) => `"${schema}"."${row.tablename}"`).join(", ");
    await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  }
  await client.end();
}
