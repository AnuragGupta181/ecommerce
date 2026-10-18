import type { Db } from "../../lib/prisma.js";
import { isPoint, type Point } from "./geo.js";

/** Where to deliver: the location the app sent, else the customer's default address. */
export async function customerPoint(db: Db, userId: string, browsing: Point | null): Promise<Point | null> {
  if (browsing) return browsing;
  const address = await db.address.findFirst({
    where: { userId, lat: { not: null }, lng: { not: null } },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { lat: true, lng: true },
  });
  const point = address ? { lat: address.lat, lng: address.lng } : null;
  return isPoint(point) ? point : null;
}

export function addressPoint(address: { lat: number | null; lng: number | null }): Point | null {
  const point = { lat: address.lat, lng: address.lng };
  return isPoint(point) ? point : null;
}
