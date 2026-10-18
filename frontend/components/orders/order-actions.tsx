"use client";

import { MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { titleCase } from "@/lib/format";
import type { OrderDetail, OrderStatus, RiderRow } from "@/lib/types";
import { useAction } from "@/lib/use-action";

const NOTE_REQUIRED: OrderStatus[] = ["CANCELLED", "RETURN_REJECTED"];

type Result = { ok: true; data: unknown } | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Server Actions for the portal showing the order: admins and vendors call different endpoints. */
export type OrderActionSet = {
  updateStatus: (id: string, status: OrderStatus, note?: string) => Promise<Result>;
  assignRider: (id: string, riderId: string) => Promise<Result>;
  resend: (id: string) => Promise<Result>;
  saveNote?: (id: string, note: string) => Promise<Result>;
};

export function OrderActions({ order, riders, actions, ridersHref }: { order: OrderDetail; riders: RiderRow[]; actions: OrderActionSet; ridersHref: string }) {
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">(order.allowedTransitions[0] ?? "");
  const [statusNote, setStatusNote] = useState("");
  const [riderId, setRiderId] = useState(order.rider?.id ?? "");
  const [adminNote, setAdminNote] = useState(order.adminNote ?? "");
  const status = useAction();
  const rider = useAction();
  const resend = useAction();
  const note = useAction();

  const saveNote = actions.saveNote;
  const noteRequired = nextStatus !== "" && NOTE_REQUIRED.includes(nextStatus);

  return (
    <>
      {order.allowedTransitions.length > 0 ? (
        <Card title="Update status">
          <div className="flex flex-col gap-3 p-5">
            <Field label="Move to" htmlFor="next-status">
              <Select id="next-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as OrderStatus)}>
                {order.allowedTransitions.map((transition) => (
                  <option key={transition} value={transition}>
                    {titleCase(transition)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={noteRequired ? "Reason (shown to the customer)" : "Note (optional)"} htmlFor="status-note" error={status.fieldErrors.note}>
              <Input id="status-note" value={statusNote} onChange={(event) => setStatusNote(event.target.value)} />
            </Field>
            <Button
              variant={nextStatus === "CANCELLED" ? "danger" : "primary"}
              pending={status.pending}
              disabled={!nextStatus || (noteRequired && statusNote.trim().length < 3)}
              onClick={() =>
                nextStatus &&
                status.run(() => actions.updateStatus(order.id, nextStatus, statusNote), {
                  success: `Order marked ${titleCase(nextStatus).toLowerCase()}`,
                  onSuccess: () => setStatusNote(""),
                })
              }
            >
              Update status
            </Button>
          </div>
        </Card>
      ) : null}

      <Card title="Rider">
        <div className="flex flex-col gap-3 p-5">
          {order.rider ? (
            <div className="rounded-control bg-brand-50 p-3">
              <p className="font-semibold">{order.rider.name}</p>
              <p className="text-ink-700">
                {order.rider.phone} · {titleCase(order.rider.vehicleType)} {order.rider.vehicleNumber ?? ""}
              </p>
            </div>
          ) : null}
          {order.canAssignRider ? (
            riders.length === 0 ? (
              <p className="text-ink-500">
                No active riders. <Link href={ridersHref} className="font-semibold text-brand-700 hover:underline">Register a rider</Link> first.
              </p>
            ) : (
              <>
                <Field label={order.rider ? "Reassign to" : "Assign rider"} htmlFor="rider">
                  <Select id="rider" value={riderId} onChange={(event) => setRiderId(event.target.value)}>
                    <option value="">Select a rider</option>
                    {riders.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} · {option.activeOrders} active
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  pending={rider.pending}
                  disabled={!riderId || riderId === order.rider?.id}
                  onClick={() => rider.run(() => actions.assignRider(order.id, riderId), { success: "Rider assigned. The customer and rider are being notified." })}
                >
                  {order.rider ? "Reassign rider" : "Assign and notify"}
                </Button>
              </>
            )
          ) : !order.rider ? (
            <p className="text-ink-500">Riders can be assigned while the order is being prepared.</p>
          ) : null}

          {order.rider ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <Button variant="outline" pending={resend.pending} onClick={() => resend.run(() => actions.resend(order.id), { success: "Notifications re-sent" })}>
                <Send size={14} /> Resend email & WhatsApp
              </Button>
              {order.whatsappLinks ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="w-full text-ink-500">Or message manually:</span>
                  {(
                    [
                      ["Customer", order.whatsappLinks.customer],
                      ["Rider", order.whatsappLinks.rider],
                      ["Admin", order.whatsappLinks.admin],
                    ] as const
                  ).map(([label, href]) =>
                    href ? (
                      <a key={label} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 font-semibold hover:bg-brand-50">
                        <MessageCircle size={12} /> {label}
                      </a>
                    ) : null,
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {saveNote ? (
      <Card title="Internal note">
        <div className="flex flex-col gap-3 p-5">
          <Textarea aria-label="Internal note" rows={3} value={adminNote} placeholder="Only visible to admins" onChange={(event) => setAdminNote(event.target.value)} />
          <Button variant="outline" pending={note.pending} disabled={adminNote === (order.adminNote ?? "")} onClick={() => note.run(() => saveNote(order.id, adminNote), { success: "Note saved" })}>
            Save note
          </Button>
        </div>
      </Card>
      ) : null}
    </>
  );
}
