"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { titleCase } from "@/lib/format";
import type { TicketLevel, TicketStatus } from "@/lib/marketplace-types";
import { useAction } from "@/lib/use-action";

type Result = { ok: true; data: unknown } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export type TicketActionSet = {
  reply: (id: string, body: string) => Promise<Result>;
  setStatus: (id: string, status: TicketStatus, note?: string) => Promise<Result>;
  setLevel?: (id: string, level: TicketLevel) => Promise<Result>;
};

const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function TicketReply({ ticketId, actions }: { ticketId: string; actions: TicketActionSet }) {
  const [body, setBody] = useState("");
  const { pending, run } = useAction();
  return (
    <div className="flex flex-col gap-2 border-t border-line p-4">
      <Textarea aria-label="Reply" rows={3} placeholder="Write a reply; the customer is notified" value={body} onChange={(event) => setBody(event.target.value)} />
      <div className="flex justify-end">
        <Button pending={pending} disabled={!body.trim()} onClick={() => run(() => actions.reply(ticketId, body.trim()), { success: "Reply sent", onSuccess: () => setBody("") })}>
          Send reply
        </Button>
      </div>
    </div>
  );
}

export function TicketStatusCard({ ticketId, status, level, actions }: { ticketId: string; status: TicketStatus; level: TicketLevel; actions: TicketActionSet }) {
  const [next, setNext] = useState<TicketStatus>(status);
  const statusAction = useAction();
  const levelAction = useAction();
  const setLevel = actions.setLevel;

  return (
    <Card title="Handling">
      <div className="flex flex-col gap-3 p-5">
        <Field label="Status" htmlFor="ticket-status">
          <Select id="ticket-status" value={next} onChange={(event) => setNext(event.target.value as TicketStatus)}>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          variant="outline"
          pending={statusAction.pending}
          disabled={next === status}
          onClick={() => statusAction.run(() => actions.setStatus(ticketId, next), { success: `Ticket ${titleCase(next).toLowerCase()}` })}
        >
          Update status
        </Button>
        {setLevel ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <p className="text-ink-700">{level === "MAJOR" ? "Handled by the platform team." : "Handled by the shop."}</p>
            <Button
              variant="outline"
              pending={levelAction.pending}
              onClick={() =>
                levelAction.run(() => setLevel(ticketId, level === "MAJOR" ? "MINOR" : "MAJOR"), {
                  success: level === "MAJOR" ? "Handed to the shop" : "Escalated to the platform",
                })
              }
            >
              {level === "MAJOR" ? "Hand to the shop" : "Escalate to platform"}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
