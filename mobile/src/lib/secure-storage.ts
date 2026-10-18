import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Session storage: the device keychain on phones. Browsers have no keychain, so the web build
 * falls back to localStorage (same-origin only; the trade-off of any SPA holding tokens).
 */
export const secureStorage = {
  getItem: (key: string): Promise<string | null> =>
    Platform.OS === "web" ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null) : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string): Promise<void> => {
    if (Platform.OS !== "web") return SecureStore.setItemAsync(key, value);
    globalThis.localStorage?.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (Platform.OS !== "web") return SecureStore.deleteItemAsync(key);
    globalThis.localStorage?.removeItem(key);
    return Promise.resolve();
  },
};
