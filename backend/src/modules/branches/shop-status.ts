/**
 * Pure open/closed logic for a shop (branch). Hours are shop-local "HH:MM" strings;
 * every shop is in India, so local time is IST (UTC+5:30, no daylight saving).
 */

export type ShopState = "OPEN" | "CLOSED";

export type ShopStatus = {
  state: ShopState;
  /** Shown to customers when closed, e.g. "Opens at 06:00" or the vendor's own message. */
  message: string | null;
};

type ShopHours = {
  isActive: boolean;
  isOnline: boolean;
  offlineMessage: string | null;
  opensAt: string | null;
  closesAt: string | null;
  vendorApproved: boolean;
};

const IST_OFFSET_MINUTES = 330;

export function minutesOfDayIST(now: Date): number {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + IST_OFFSET_MINUTES) % (24 * 60);
}

export function parseHHMM(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Handles overnight hours too (e.g. 18:00–02:00). */
export function isWithinHours(opensAt: string | null, closesAt: string | null, minute: number): boolean {
  const open = opensAt ? parseHHMM(opensAt) : null;
  const close = closesAt ? parseHHMM(closesAt) : null;
  if (open === null || close === null || open === close) return true;
  return open < close ? minute >= open && minute < close : minute >= open || minute < close;
}

export function shopStatus(shop: ShopHours, now = new Date()): ShopStatus {
  if (!shop.vendorApproved || !shop.isActive) return { state: "CLOSED", message: "Not taking orders" };
  if (!shop.isOnline) return { state: "CLOSED", message: shop.offlineMessage || "Closed for now" };
  if (!isWithinHours(shop.opensAt, shop.closesAt, minutesOfDayIST(now))) {
    return { state: "CLOSED", message: shop.opensAt ? `Opens at ${shop.opensAt}` : "Closed for now" };
  }
  return { state: "OPEN", message: null };
}

/** Narrows a branch row (with its vendor's status) to the fields `shopStatus` needs. */
export function shopHoursOf(branch: {
  isActive: boolean;
  isOnline: boolean;
  offlineMessage: string | null;
  opensAt: string | null;
  closesAt: string | null;
  vendor: { status: string };
}): ShopHours {
  return {
    isActive: branch.isActive,
    isOnline: branch.isOnline,
    offlineMessage: branch.offlineMessage,
    opensAt: branch.opensAt,
    closesAt: branch.closesAt,
    vendorApproved: branch.vendor.status === "APPROVED",
  };
}
