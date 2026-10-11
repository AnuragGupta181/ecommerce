import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { CategoryNode, Facets, HomeFeed, ProductCard, ProductDetail, ReviewItem, StoreSettings, Suggestions } from "@/lib/types";

export type ListingQuery = {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  discount?: number;
  inStock?: boolean;
  sort?: string;
  ids?: string;
};

/** Personalised fields (wishlist hearts) depend on who is signed in. */
const useViewer = () => useAuthStore((state) => state.user?.id ?? "guest");

export function useHome() {
  const viewer = useViewer();
  return useQuery({ queryKey: ["home", viewer], queryFn: () => api.get<HomeFeed>("/home") });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => api.get<CategoryNode[]>("/categories"), staleTime: 5 * 60_000 });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => api.get<StoreSettings>("/settings"), staleTime: 5 * 60_000 });
}

export function useProducts(query: ListingQuery, enabled = true) {
  const viewer = useViewer();
  return useInfiniteQuery({
    queryKey: ["products", query, viewer],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.page<ProductCard>("/products", { ...query, page: pageParam, limit: 20 }),
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useFacets(query: ListingQuery) {
  return useQuery({ queryKey: ["facets", { ...query, brand: undefined }], queryFn: () => api.get<Facets>("/products/facets", { ...query, brand: undefined }) });
}

export function useProduct(slug: string) {
  const viewer = useViewer();
  return useQuery({ queryKey: ["product", slug, viewer], queryFn: () => api.get<ProductDetail>(`/products/${slug}`) });
}

export function useSimilarProducts(slug: string) {
  const viewer = useViewer();
  return useQuery({ queryKey: ["similar", slug, viewer], queryFn: () => api.get<ProductCard[]>(`/products/${slug}/similar`) });
}

export function useSuggestions(q: string) {
  return useQuery({
    queryKey: ["suggestions", q],
    enabled: q.trim().length >= 2,
    queryFn: () => api.get<Suggestions>("/products/suggestions", { q: q.trim() }),
    placeholderData: keepPreviousData,
  });
}

export function useTrendingSearches() {
  return useQuery({ queryKey: ["trending"], queryFn: () => api.get<string[]>("/products/trending-searches"), staleTime: 10 * 60_000 });
}

export function useProductReviews(productId: string, sort: string) {
  return useInfiniteQuery({
    queryKey: ["reviews", productId, sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.page<ReviewItem & { user?: { name: string } }>("/reviews", { productId, sort, page: pageParam, limit: 10 }),
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
}
