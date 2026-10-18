"use client";

import { Copy, Link2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sendScheduleLink } from "@/app/vendor/(portal)/riders/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAction } from "@/lib/use-action";

/** Sends a rider their private daily schedule page (no login needed; the link itself is the key). */
export function ScheduleLinkButton({ riderId, riderName }: { riderId: string; riderName: string }) {
  const [link, setLink] = useState<{ url: string; whatsapp: string | null } | null>(null);
  const { pending, run } = useAction();

  return (
    <>
      <Button size="sm" variant="outline" pending={pending} onClick={() => run(() => sendScheduleLink(riderId), { onSuccess: setLink })}>
        <Link2 size={14} /> Schedule link
      </Button>
      <Modal open={link !== null} onClose={() => setLink(null)} title={`Schedule link for ${riderName}`}>
        {link ? (
          <div className="flex flex-col gap-4">
            <p className="text-ink-700">Emailed to the rider when they have an email. It lists today&apos;s drops with phone numbers and maps, and the month ahead. Keep it private.</p>
            <code className="rounded-control border border-line bg-canvas p-3 text-xs break-all">{link.url}</code>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void navigator.clipboard.writeText(link.url).then(() => toast.success("Link copied"))}>
                <Copy size={14} /> Copy
              </Button>
              {link.whatsapp ? (
                <a href={link.whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-500 px-4 font-semibold text-ink-900 hover:bg-brand-400">
                  <MessageCircle size={14} /> Send on WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
