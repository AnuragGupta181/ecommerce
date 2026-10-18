import { router } from "expo-router";
import { Linking } from "react-native";
import type { ListingQuery } from "@/hooks/use-catalog";
import type { Banner } from "./types";

type ListingParams = { title?: string } & { [K in keyof ListingQuery]?: string };

/** Route params are strings; the listing screen turns them back into a typed query. */
export function openListing(query: Partial<Record<keyof ListingQuery, string | number | boolean>>, title?: string) {
  const params: ListingParams = { title };
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params[key as keyof ListingQuery] = String(value);
  }
  router.push({ pathname: "/products", params });
}

export function parseListing(params: ListingParams): ListingQuery {
  const num = (value?: string) => (value ? Number(value) || undefined : undefined);
  return {
    q: params.q || undefined,
    category: params.category || undefined,
    brand: params.brand || undefined,
    minPrice: num(params.minPrice),
    maxPrice: num(params.maxPrice),
    rating: num(params.rating),
    discount: num(params.discount),
    inStock: params.inStock === "true" || undefined,
    sort: params.sort || undefined,
    ids: params.ids || undefined,
    vendor: params.vendor || undefined,
  };
}

export function openBanner(banner: Banner) {
  const value = banner.linkValue;
  if (!value) return;
  switch (banner.linkType) {
    case "PRODUCT":
      router.push(`/product/${value}`);
      break;
    case "CATEGORY":
      openListing({ category: value }, banner.title);
      break;
    case "SEARCH":
      openListing({ q: value }, value);
      break;
    case "URL":
      Linking.openURL(value).catch(() => undefined);
      break;
  }
}
