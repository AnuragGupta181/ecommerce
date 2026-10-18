import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { lastMessageAt, mergeMessages } from "@/lib/chat-thread";
import type { ChatMessage, Conversation, TicketDetail, TicketInput, TicketSummary } from "@/lib/types";
import { useLiveInterval } from "./use-live-interval";

const useSignedIn = () => useAuthStore((state) => state.user !== null);

/** Chat has no sockets: open threads poll every few seconds, the inbox a little slower. */
const THREAD_POLL_MS = 5_000;

export function useTickets() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: ["tickets", "list"], enabled: signedIn, queryFn: () => api.get<TicketSummary[]>("/tickets", { limit: 50 }) });
}

export function useTicket(id: string) {
  const refetchInterval = useLiveInterval(15_000);
  return useQuery({ queryKey: ["tickets", id], queryFn: () => api.get<TicketDetail>(`/tickets/${id}`), refetchInterval });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketInput) => api.post<{ id: string }>("/tickets", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useReplyTicket(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (body: string) => api.post(`/tickets/${id}/messages`, { body }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }) });
}

export function useCloseTicket(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => api.patch(`/tickets/${id}/status`, { status: "CLOSED" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }) });
}

export function useConversations() {
  const signedIn = useSignedIn();
  const refetchInterval = useLiveInterval(20_000);
  return useQuery({ queryKey: ["chat", "list"], enabled: signedIn, queryFn: () => api.get<Conversation[]>("/chat", { limit: 50 }), refetchInterval });
}

export function useChatUnread() {
  const signedIn = useSignedIn();
  const refetchInterval = useLiveInterval(30_000);
  return useQuery({ queryKey: ["chat", "unread"], enabled: signedIn, queryFn: () => api.get<{ count: number }>("/chat/unread"), select: (data) => data.count, refetchInterval });
}

/** Opens (or finds) the conversation with a shop and returns its id. */
export function useOpenChat() {
  return useMutation({ mutationFn: (vendorId: string) => api.post<{ id: string }>(`/chat/vendors/${vendorId}`) });
}

/**
 * The thread lives in the query cache. Each poll asks only for messages newer than the last one
 * held (`after=`) and merges them in, so a long conversation is not re-downloaded every few seconds.
 */
export function useChatThread(conversationId: string) {
  const queryClient = useQueryClient();
  const key = ["chat", conversationId, "thread"];
  const refetchInterval = useLiveInterval(THREAD_POLL_MS);

  const thread = useQuery({
    queryKey: key,
    queryFn: async () => {
      const current = queryClient.getQueryData<ChatMessage[]>(key) ?? [];
      const { messages } = await api.get<{ conversationId: string; messages: ChatMessage[] }>(`/chat/${conversationId}/messages`, { after: lastMessageAt(current) });
      if (messages.some((message) => !message.mine)) {
        void api.post(`/chat/${conversationId}/read`).then(() => queryClient.invalidateQueries({ queryKey: ["chat", "unread"] }));
      }
      return mergeMessages(current, messages);
    },
    refetchInterval,
  });

  const send = useMutation({
    mutationFn: (input: { body: string; orderId?: string }) => api.post(`/chat/${conversationId}/messages`, input),
    // The send response is the raw row; the next poll returns it in thread shape (with `mine`).
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
    },
  });

  return { messages: thread.data ?? [], isPending: thread.isPending, error: thread.error, send };
}
