"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPayout, markPayoutPaid, previewPayout } from "@/app/(dashboard)/payouts/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatINR } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { netLabel, type SettlementRows } from "./settlement-view";

export function NewPayoutButton({ vendors, defaultRange }: { vendors: { id: string; shopName: string }[]; defaultRange: { from: string; to: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<SettlementRows | null>(null);
  const check = useAction();
  const create = useAction();

  return (
    <>
      <Button
        onClick={() => {
          setPreview(null);
          setOpen(true);
        }}
      >
        <Plus size={16} /> New payout
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Settle with a shop"
        footer={
          <>
            <Button variant="outline" pending={check.pending} onClick={() => check.run(() => previewPayout(vendorId, from, to), { onSuccess: setPreview })}>
              Preview
            </Button>
            <Button
              pending={create.pending}
              disabled={!preview || preview.orderCount + preview.deliveryCount === 0}
              onClick={() =>
                create.run(() => createPayout({ vendorId, from, to, note: note.trim() || undefined }), {
                  success: "Payout created; the shop has been emailed its statement",
                  onSuccess: (payout) => router.push(`/payouts/${payout.id}`),
                })
              }
            >
              Create payout
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Shop" htmlFor="payout-vendor">
            <Select
              id="payout-vendor"
              value={vendorId}
              onChange={(event) => {
                setVendorId(event.target.value);
                setPreview(null);
              }}
            >
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.shopName}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="payout-from" error={check.fieldErrors.from}>
              <Input id="payout-from" type="date" value={from} onChange={(event) => (setFrom(event.target.value), setPreview(null))} />
            </Field>
            <Field label="To" htmlFor="payout-to" error={check.fieldErrors.to}>
              <Input id="payout-to" type="date" value={to} onChange={(event) => (setTo(event.target.value), setPreview(null))} />
            </Field>
          </div>
          <Field label="Note (optional)" htmlFor="payout-note">
            <Input id="payout-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {preview ? (
            <div className="rounded-control bg-brand-50 p-3">
              <p className="font-semibold">{netLabel(preview.netAmount)}</p>
              <p className="text-ink-700">
                {preview.orderCount} orders and {preview.deliveryCount} drops, sales {formatINR(preview.grossAmount)}, commission {formatINR(preview.commissionAmount)}.
              </p>
            </div>
          ) : (
            <p className="text-ink-500">Preview first: only delivered, unsettled sales in the period are included.</p>
          )}
        </div>
      </Modal>
    </>
  );
}

export function MarkPaidCard({ payoutId }: { payoutId: string }) {
  const [reference, setReference] = useState("");
  const { pending, fieldErrors, run } = useAction();
  return (
    <Card title="Mark as settled">
      <div className="flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-64 flex-1">
          <Field label="Transfer reference (UTR, cheque, cash receipt)" htmlFor="paid-reference" error={fieldErrors.reference}>
            <Input id="paid-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
        </div>
        <Button pending={pending} disabled={reference.trim().length < 2} onClick={() => run(() => markPayoutPaid(payoutId, reference.trim()), { success: "Marked paid" })}>
          Mark paid
        </Button>
      </div>
    </Card>
  );
}
