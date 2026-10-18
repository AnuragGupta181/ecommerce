import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useLocationStore } from "@/lib/location-store";
import type { Plan, SubscriptionDetail, SubscriptionInput, SubscriptionQuote, SubscriptionSummary } from "@/lib/types";

const useSignedIn = () => useAuthStore((state) => state.user !== null);
const useLocationKey = () => useLocationStore((state) => (state.location ? `${state.location.lat},${state.location.lng}` : "none"));

/** Daily essentials: plans from shops that deliver to the shopper, deliverable first. */
export function usePlans(query: { q?: string; vendor?: string } = {}) {
  const where = useLocationKey();
  return useQuery({ queryKey: ["plans", query, where], queryFn: () => api.get<Plan[]>("/plans", { ...query, limit: 50 }) });
}

export function usePlan(id: string) {
  const where = useLocationKey();
  return useQuery({ queryKey: ["plan", id, where], queryFn: () => api.get<Plan>(`/plans/${id}`) });
}

/** The server computes every date and rupee; the screen only shows the breakdown it returns. */
export function useSubscriptionQuote(input: SubscriptionInput | null) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: ["subscription-quote", input],
    enabled: signedIn && input !== null && input.weekdays > 0,
    queryFn: () => api.post<SubscriptionQuote>("/subscriptions/quote", input),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateSubscriptions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
}

export function useSubscribe() {
  const invalidate = useInvalidateSubscriptions();
  return useMutation({ mutationFn: (input: SubscriptionInput & { addressId: string }) => api.post<{ id: string }>("/subscriptions", input), onSuccess: invalidate });
}

export function useSubscriptions() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ["subscriptions", "list"], enabled: signedIn, queryFn: () => api.get<SubscriptionSummary[]>("/subscriptions", { limit: 50 }) });
}

export function useSubscription(id: string) {
  return useQuery({ queryKey: ["subscriptions", id], queryFn: () => api.get<SubscriptionDetail>(`/subscriptions/${id}`) });
}

export function useSkipDelivery(id: string) {
  const invalidate = useInvalidateSubscriptions();
  return useMutation({ mutationFn: (input: { date: string; skip: boolean }) => api.post(`/subscriptions/${id}/skip`, input), onSuccess: invalidate });
}

export function usePauseSubscription(id: string) {
  const invalidate = useInvalidateSubscriptions();
  return useMutation({ mutationFn: (input: { fromDate: string; toDate: string }) => api.post(`/subscriptions/${id}/pauses`, input), onSuccess: invalidate });
}

export function useResumePause(id: string) {
  const invalidate = useInvalidateSubscriptions();
  return useMutation({ mutationFn: (pauseId: string) => api.delete(`/subscriptions/${id}/pauses/${pauseId}`), onSuccess: invalidate });
}

export function useCancelSubscription(id: string) {
  const invalidate = useInvalidateSubscriptions();
  return useMutation({ mutationFn: (reason: string) => api.post(`/subscriptions/${id}/cancel`, { reason }), onSuccess: invalidate });
}

export function useRenewSubscription(id: string) {
  const invalidate = useInvalidateSubscriptions();
  return useMutation({ mutationFn: () => api.post<{ id: string }>(`/subscriptions/${id}/renew`), onSuccess: invalidate });
}
