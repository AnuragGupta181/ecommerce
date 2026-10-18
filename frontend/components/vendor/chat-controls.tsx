"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { markConversationRead, sendMessage } from "@/app/vendor/(portal)/messages/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useAction } from "@/lib/use-action";

/** No websockets on serverless hosting: re-render the server page every few seconds while it is open and visible. */
export function PollRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}

export function MarkRead({ conversationId, unread }: { conversationId: string; unread: number }) {
  useEffect(() => {
    if (unread > 0) void markConversationRead(conversationId);
  }, [conversationId, unread]);
  return null;
}

export function ChatComposer({ conversationId }: { conversationId: string }) {
  const [body, setBody] = useState("");
  const { pending, run } = useAction();
  return (
    <form
      className="flex gap-2 border-t border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim()) run(() => sendMessage(conversationId, body.trim()), { onSuccess: () => setBody("") });
      }}
    >
      <Input aria-label="Message" placeholder="Type a message" value={body} onChange={(event) => setBody(event.target.value)} />
      <Button type="submit" pending={pending} disabled={!body.trim()} aria-label="Send">
        <Send size={16} />
      </Button>
    </form>
  );
}
