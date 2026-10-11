import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { ProductCard } from "@/lib/types";

export function useWishlist() {
  const signedIn = useAuthStore((state) => state.user !== null);
  return useQuery({ queryKey: ["wishlist"], enabled: signedIn, queryFn: () => api.get<ProductCard[]>("/wishlist") });
}

export function useToggleWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, wishlisted }: { productId: string; wishlisted: boolean }) =>
      wishlisted ? api.delete(`/wishlist/${productId}`) : api.put(`/wishlist/${productId}`),
    onSuccess: () => {
      // Hearts appear on every product surface, so refresh them all.
      for (const key of ["wishlist", "home", "products", "product", "similar"]) queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
}
