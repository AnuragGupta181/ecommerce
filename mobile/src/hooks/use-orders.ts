import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OrderDetail, OrderSummary } from "@/lib/types";

export type OrderFilter = "active" | "delivered" | "cancelled" | "returns" | undefined;

export function useOrders(status: OrderFilter) {
  return useInfiniteQuery({
    queryKey: ["orders", "list", status ?? "all"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.page<OrderSummary>("/orders", { status, page: pageParam, limit: 15 }),
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: ["orders", "detail", id], queryFn: () => api.get<OrderDetail>(`/orders/${id}`) });
}

function useOrderMutation(path: "cancel" | "return") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/orders/${id}/${path}`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["coins"] });
    },
  });
}

export const useCancelOrder = () => useOrderMutation("cancel");
export const useRequestReturn = () => useOrderMutation("return");

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; rating: number; title?: string; comment?: string }) => api.post("/reviews", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}
