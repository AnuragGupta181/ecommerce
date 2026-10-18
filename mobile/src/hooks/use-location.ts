import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback } from "react";
import { useLocationStore, type DeliveryLocation } from "@/lib/location-store";

export type DetectedPlace = {
  lat: number;
  lng: number;
  label: string;
  /** Reverse-geocoded parts, used to prefill a new address. Any of them may be missing. */
  street: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
};

/** Asks for foreground permission, reads the GPS fix and names it. Throws a readable message. */
export async function detectCurrentPlace(): Promise<DetectedPlace> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error("Location permission is off. Pick your area from the list instead.");
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 200 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude: lat, longitude: lng } = position.coords;

  // Naming the spot is nice to have; a failed lookup still leaves a usable point.
  const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
  const area = place?.district ?? place?.subregion ?? null;
  const city = place?.city ?? null;
  return {
    lat,
    lng,
    label: [area, city].filter(Boolean).join(", ") || "Current location",
    street: [place?.streetNumber, place?.street].filter(Boolean).join(" ") || place?.name || null,
    area,
    city,
    state: place?.region ?? null,
    pincode: place?.postalCode ?? null,
  };
}

/** Changing location re-prices everything, so every cached query is refetched. */
export function useSetLocation() {
  const queryClient = useQueryClient();
  return useCallback(
    async (location: DeliveryLocation) => {
      await useLocationStore.getState().setLocation(location);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );
}

export function useDetectLocation() {
  const setLocation = useSetLocation();
  return useMutation({
    mutationFn: async () => {
      const place = await detectCurrentPlace();
      await setLocation({ lat: place.lat, lng: place.lng, label: place.label, source: "gps" });
      return place;
    },
  });
}

export const useDeliveryLocation = () => useLocationStore((state) => state.location);
