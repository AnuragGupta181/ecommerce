"use client";

import { MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { markDropMissed, markDropsDelivered } from "@/app/vendor/(portal)/deliveries/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatINR, titleCase } from "@/lib/format";
import type { DeliveryDay } from "@/lib/marketplace-types";
import { deliveryTone } from "@/lib/status-tones";
import { useAction } from "@/lib/use-action";

/** The day's drops: tick what went out and press one button, the way the shop actually works in the morning. */
export function DeliveryList({ deliveries }: { deliveries: DeliveryDay["deliveries"] }) {
  const scheduled = deliveries.filter((drop) => drop.status === "SCHEDULED").map((drop) => drop.id);
  const [selected, setSelected] = useState<Set<string>>(new Set(scheduled));
  const [missing, setMissing] = useState<{ id: string; name: string } | null>(null);
  const [note, setNote] = useState("");
  const sent = useAction();
  const missed = useAction();

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <label className="flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            className="size-4 accent-brand-600"
            checked={scheduled.length > 0 && scheduled.every((id) => selected.has(id))}
            disabled={scheduled.length === 0}
            onChange={(event) => setSelected(new Set(event.target.checked ? scheduled : []))}
          />
          Select all pending ({scheduled.length})
        </label>
        <Button
          pending={sent.pending}
          disabled={selected.size === 0}
          onClick={() => sent.run(() => markDropsDelivered([...selected]), { success: `${selected.size} marked delivered; stock updated`, onSuccess: () => setSelected(new Set()) })}
        >
          Delivery sent ({selected.size})
        </Button>
      </div>
      <ul className="flex flex-col">
        {deliveries.map((drop) => {
          const pending = drop.status === "SCHEDULED";
          return (
            <li key={drop.id} className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <input type="checkbox" aria-label={`Select ${drop.customer.name}`} className="mt-1 size-4 accent-brand-600" disabled={!pending} checked={selected.has(drop.id)} onChange={() => toggle(drop.id)} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {drop.customer.name} · {drop.quantity} × {drop.product}
                </p>
                <p className="text-ink-700">{drop.address}</p>
                <p className="mt-1 flex flex-wrap gap-3 text-xs text-ink-500">
                  <span>{drop.slot ?? "Any time"}</span>
                  <span>{drop.planName}</span>
                  <Link href={`/vendor/subscriptions/${drop.subscription.id}`} className="font-semibold hover:underline">
                    {drop.subscription.number}
                  </Link>
                  <span>Rider: {drop.rider?.name ?? "not assigned"}</span>
                  {drop.customer.phone ? (
                    <a href={`tel:${drop.customer.phone}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
                      <Phone size={12} /> {drop.customer.phone}
                    </a>
                  ) : null}
                  {drop.mapUrl ? (
                    <a href={drop.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold hover:underline">
                      <MapPin size={12} /> Map
                    </a>
                  ) : null}
                </p>
                {drop.note ? <p className="mt-1 text-xs text-danger">{drop.note}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={deliveryTone[drop.status]}>{titleCase(drop.status)}</Badge>
                <span className="tabular text-xs text-ink-500">{formatINR(drop.amount)}</span>
                {pending ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNote("");
                      setMissing({ id: drop.id, name: drop.customer.name });
                    }}
                  >
                    Missed
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Modal
        open={missing !== null}
        onClose={() => setMissing(null)}
        title={`Missed drop for ${missing?.name ?? ""}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setMissing(null)}>
              Cancel
            </Button>
            <Button
              pending={missed.pending}
              disabled={note.trim().length < 2}
              onClick={() => missing && missed.run(() => markDropMissed(missing.id, note), { success: "Marked missed; the customer is not charged", onSuccess: () => setMissing(null) })}
            >
              Mark missed
            </Button>
          </>
        }
      >
        <p className="mb-3 text-ink-700">The customer is not charged for a missed drop. Say what happened.</p>
        <Input aria-label="Reason" placeholder="Customer not home" value={note} onChange={(event) => setNote(event.target.value)} />
      </Modal>
    </>
  );
}
