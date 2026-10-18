import type { ChatMessage } from "./types";

/** Appends polled messages, dropping ones already shown (a send and a poll can race). */
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return existing;
  const seen = new Set(existing.map((message) => message.id));
  const fresh = incoming.filter((message) => !seen.has(message.id));
  if (!fresh.length) return existing;
  return [...existing, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The `after=` cursor for the next poll: the newest message we hold. */
export function lastMessageAt(messages: ChatMessage[]): string | undefined {
  return messages.length ? messages[messages.length - 1].createdAt : undefined;
}
