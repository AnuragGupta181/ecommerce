import { ApiError } from "./api";
import type { Shop } from "./types";

export type ShopConflict = { cartShop: Shop | null; newShop: Shop | null };

/** A cart holds one shop's items; adding from another returns 409 CART_SHOP_CONFLICT with both shops. */
export function shopConflict(error: unknown): ShopConflict | null {
  if (!(error instanceof ApiError) || error.code !== "CART_SHOP_CONFLICT") return null;
  const details = (error.details ?? {}) as Partial<ShopConflict>;
  return { cartShop: details.cartShop ?? null, newShop: details.newShop ?? null };
}

export function conflictMessage(conflict: ShopConflict): string {
  const current = conflict.cartShop?.vendorName ?? "another shop";
  const next = conflict.newShop?.vendorName ?? "this shop";
  return `Your cart has items from ${current}. Start a new cart from ${next}? Your current cart will be cleared.`;
}

/** Checkout refuses a closed or too-far shop with 409 SHOP_UNAVAILABLE. */
export function isShopUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === "SHOP_UNAVAILABLE";
}
