import type { Db } from "./prisma.js";

export type DocumentSeries = "INV" | "RCPT" | "SUB" | "TKT" | "PAY" | "BILL";

/**
 * Next sequential number in a series, per year: INV-2026-000123.
 * The upsert increments atomically, so concurrent transactions never share a number.
 */
export async function nextNumber(db: Db, series: DocumentSeries, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const key = `${series}-${year}`;
  const counter = await db.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  return `${key}-${String(counter.value).padStart(6, "0")}`;
}
