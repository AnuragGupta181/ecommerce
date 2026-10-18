import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocationStore } from "@/lib/location-store";
import type { Shop, VendorPage } from "@/lib/types";

/** Distances and fees depend on where the shopper is, so location is part of every key. */
const useLocationKey = () => useLocationStore((state) => (state.location ? `${state.location.lat},${state.location.lng}` : "none"));

export function useVendorPage(slug: string) {
  const where = useLocationKey();
  return useQuery({ queryKey: ["vendor", slug, where], queryFn: () => api.get<VendorPage>(`/vendors/${slug}`) });
}

export function useNearbyShops() {
  const where = useLocationKey();
  return useQuery({ queryKey: ["shops", "nearby", where], queryFn: () => api.get<Shop[]>("/branches/nearby", { limit: 20 }) });
}
