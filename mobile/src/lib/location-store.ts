import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { isValidPoint, type Point } from "./geo";

const KEY = "haat.location";

export type DeliveryLocation = Point & { label: string; source: "gps" | "manual" };

type LocationState = {
  location: DeliveryLocation | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocation: (location: DeliveryLocation) => Promise<void>;
  clear: () => Promise<void>;
};

function parse(raw: string | null): DeliveryLocation | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DeliveryLocation>;
    if (typeof value.lat !== "number" || typeof value.lng !== "number" || !isValidPoint({ lat: value.lat, lng: value.lng })) return null;
    return { lat: value.lat, lng: value.lng, label: typeof value.label === "string" ? value.label : "Pinned location", source: value.source === "gps" ? "gps" : "manual" };
  } catch {
    return null;
  }
}

/** A device preference, not account data: guests shop by location too. */
export const useLocationStore = create<LocationState>((set) => ({
  location: null,
  hydrated: false,

  hydrate: async () => {
    try {
      set({ location: parse(await AsyncStorage.getItem(KEY)) });
    } catch {
      // Unreadable storage just means "ask again".
    } finally {
      set({ hydrated: true });
    }
  },

  setLocation: async (location) => {
    set({ location });
    await AsyncStorage.setItem(KEY, JSON.stringify(location)).catch(() => undefined);
  },

  clear: async () => {
    set({ location: null });
    await AsyncStorage.removeItem(KEY).catch(() => undefined);
  },
}));
