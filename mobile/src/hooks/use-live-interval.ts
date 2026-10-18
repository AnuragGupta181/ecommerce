import { useIsFocused } from "expo-router";

/** Stock and shop status change under the shopper; poll while the screen is visible, no sockets. */
export const LIVE_STOCK_INTERVAL = 25_000;

export function useLiveInterval(ms: number = LIVE_STOCK_INTERVAL): number | false {
  return useIsFocused() ? ms : false;
}
