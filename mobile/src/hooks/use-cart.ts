import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { Cart, CartCoupon, PlacedOrder, PriceSummary, CartLine } from "@/lib/types";

const useSignedIn = () => useAuthStore((state) => state.user !== null);

export function useCartCount() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ["cart", "count"], enabled: signedIn, queryFn: () => api.get<{ count: number }>("/cart/count"), select: (data) => data.count });
}

/** The server prices everything; the app only passes the shopper's choices. */
export function useCart(options: { coupon?: string; useCoins?: boolean }) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: ["cart", "detail", options],
    enabled: signedIn,
    queryFn: () => api.get<Cart>("/cart", { coupon: options.coupon, useCoins: options.useCoins || undefined }),
  });
}

export function useCartCoupons(enabled: boolean) {
  return useQuery({ queryKey: ["cart", "coupons"], enabled, queryFn: () => api.get<CartCoupon[]>("/cart/coupons") });
}

function useInvalidateCart() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["cart"] });
}

export function useAddToCart() {
  const invalidate = useInvalidateCart();
  return useMutation({
    mutationFn: (input: { variantId: string; quantity: number }) => api.post("/cart/items", input),
    onSuccess: invalidate,
  });
}

export function useUpdateCartItem() {
  const invalidate = useInvalidateCart();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api.patch(`/cart/items/${id}`, { quantity }),
    onSuccess: invalidate,
  });
}

export function useRemoveCartItem() {
  const invalidate = useInvalidateCart();
  return useMutation({ mutationFn: (id: string) => api.delete(`/cart/items/${id}`), onSuccess: invalidate });
}

export function useSaveForLater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/cart/items/${id}/save-for-later`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });
}

export type CheckoutInput = { couponCode?: string; useCoins?: boolean; items?: { variantId: string; quantity: number }[] };

export function useQuote(input: CheckoutInput) {
  return useQuery({
    queryKey: ["quote", input],
    queryFn: () => api.post<{ items: CartLine[]; summary: PriceSummary }>("/orders/quote", input),
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput & { addressId: string; paymentMethod: "COD" | "UPI_ON_DELIVERY"; note?: string }) => api.post<PlacedOrder>("/orders", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["coins"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
