import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { api, errorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { conflictMessage, shopConflict } from "@/lib/cart-conflict";
import { useLiveInterval } from "./use-live-interval";
import type { Cart, CartCoupon, CartLine, CartShopOption, PlacedOrder, PriceSummary } from "@/lib/types";

const useSignedIn = () => useAuthStore((state) => state.user !== null);

export function useCartCount() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ["cart", "count"], enabled: signedIn, queryFn: () => api.get<{ count: number }>("/cart/count"), select: (data) => data.count });
}

/** The server prices everything; the app only passes the shopper's choices. Polls so stock and shop hours stay current. */
export function useCart(options: { coupon?: string; useCoins?: boolean }) {
  const signedIn = useSignedIn();
  const refetchInterval = useLiveInterval();
  return useQuery({
    queryKey: ["cart", "detail", options],
    enabled: signedIn,
    refetchInterval,
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
    /** Without `branchId` the server picks the best shop for the location; `replaceCart` starts over after a shop conflict. */
    mutationFn: (input: { variantId: string; quantity: number; branchId?: string; replaceCart?: boolean }) => api.post("/cart/items", input),
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

/** Other shops that could fill this cart, for "switch shop". */
export function useCartShops(enabled: boolean) {
  return useQuery({ queryKey: ["cart", "shops"], enabled, queryFn: () => api.get<CartShopOption[]>("/cart/shops") });
}

export function useSwitchShop() {
  const invalidate = useInvalidateCart();
  return useMutation({ mutationFn: (branchId: string) => api.post("/cart/shop", { branchId }), onSuccess: invalidate });
}

export type CheckoutInput = { couponCode?: string; useCoins?: boolean; items?: { variantId: string; quantity: number }[]; branchId?: string; addressId?: string };

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

type AddInput = { variantId: string; quantity: number; branchId?: string };

/**
 * Adds to the cart; if the cart holds another shop's items the server answers 409
 * CART_SHOP_CONFLICT, and the shopper decides whether to start a new cart from this shop.
 */
export function useAddToCartResolvingShop() {
  const add = useAddToCart();
  const run = (input: AddInput, options: { onAdded?: () => void } = {}) =>
    add.mutate(input, {
      onSuccess: () => options.onAdded?.(),
      onError: (error) => {
        const conflict = shopConflict(error);
        if (!conflict) {
          Alert.alert("Couldn't add to cart", errorMessage(error));
          return;
        }
        Alert.alert("Start a new cart?", conflictMessage(conflict), [
          { text: "Keep current cart", style: "cancel" },
          {
            text: "Start new cart",
            style: "destructive",
            onPress: () =>
              add.mutate(
                { ...input, replaceCart: true },
                { onSuccess: () => options.onAdded?.(), onError: (retryError) => Alert.alert("Couldn't add to cart", errorMessage(retryError)) },
              ),
          },
        ]);
      },
    });
  return { add: run, isPending: add.isPending };
}
