import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ChatComposer, MarkRead, PollRefresh } from "@/components/vendor/chat-controls";
import { formatDateTime } from "@/lib/format";
import type { ChatMessage, Conversation } from "@/lib/marketplace-types";
import { param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage({ searchParams }: PageProps<"/vendor/messages">) {
  return (
    <>
      <PageHeader title="Messages" description="Chat with your customers. New messages appear within a few seconds." />
      <Suspense fallback={<TableSkeleton />}>
        <MessagesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function MessagesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { items: conversations } = await api.list<Conversation>("/vendor/messages", { limit: 50 });
  const activeId = param(params, "c") ?? conversations[0]?.id;
  const active = conversations.find((conversation) => conversation.id === activeId);
  const thread = active ? await api.get<{ conversationId: string; messages: ChatMessage[] }>(`/vendor/messages/${active.id}/messages`) : null;

  if (conversations.length === 0) {
    return (
      <Card>
        <EmptyState icon={MessageSquare} title="No conversations yet" description="Customers can message your shop from the app." />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <PollRefresh />
      <Card className="lg:col-span-1">
        <ul className="flex max-h-[70vh] flex-col overflow-y-auto">
          {conversations.map((conversation) => (
            <li key={conversation.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/vendor/messages?c=${conversation.id}`}
                className={`flex items-start justify-between gap-2 px-4 py-3 ${conversation.id === active?.id ? "bg-brand-100" : "hover:bg-brand-50"}`}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{conversation.customer.name}</span>
                  <span className="line-clamp-1 text-xs text-ink-500">{conversation.lastMessage ?? "No messages yet"}</span>
                </span>
                {conversation.unread > 0 && conversation.id !== active?.id ? (
                  <span className="tabular rounded-full bg-brand-500 px-1.5 text-xs font-bold text-ink-900">{conversation.unread}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex flex-col lg:col-span-2">
        {active && thread ? (
          <>
            <MarkRead conversationId={active.id} unread={active.unread} />
            <header className="border-b border-line px-5 py-3">
              <p className="font-semibold">{active.customer.name}</p>
              <p className="text-xs text-ink-500">{active.customer.phone}</p>
            </header>
            <ol className="flex max-h-[55vh] flex-1 flex-col gap-3 overflow-y-auto p-5">
              {thread.messages.map((message) => (
                <li key={message.id} className={`flex ${message.senderRole === "SYSTEM" ? "justify-center" : message.mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-card px-4 py-2.5 ${
                      message.senderRole === "SYSTEM" ? "bg-canvas text-xs text-ink-500" : message.mine ? "bg-brand-100" : "border border-line"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    {message.order ? (
                      <Link href={`/vendor/orders/${message.order.id}`} className="text-xs font-semibold hover:underline">
                        Order {message.order.orderNumber}
                      </Link>
                    ) : null}
                    <p className="mt-1 text-[11px] text-ink-500">{formatDateTime(message.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ChatComposer conversationId={active.id} />
          </>
        ) : (
          <p className="p-5 text-ink-500">Pick a conversation.</p>
        )}
      </Card>
    </div>
  );
}
