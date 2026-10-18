"use client";

import { useState } from "react";
import { assignSubscriptionRider, recordPayment } from "@/app/vendor/(portal)/subscriptions/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { paiseToRupees, rupeesToPaise } from "@/lib/format";
import type { PayMethod } from "@/lib/marketplace-types";
import { useAction } from "@/lib/use-action";

export function PaymentForm({ subscriptionId, dueNow }: { subscriptionId: string; dueNow: number }) {
  const [amount, setAmount] = useState(dueNow > 0 ? paiseToRupees(dueNow) : "");
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState(false);
  const { pending, fieldErrors, run } = useAction();

  return (
    <Card title="Record a payment">
      <div className="flex flex-col gap-3 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" htmlFor="pay-amount" error={fieldErrors.amount}>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Method" htmlFor="pay-method">
            <Select id="pay-method" value={method} onChange={(event) => setMethod(event.target.value as PayMethod)}>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
        </div>
        <Field label="Note (optional)" htmlFor="pay-note">
          <Input id="pay-note" value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-ink-700">
          <input type="checkbox" className="size-4 accent-brand-600" checked={refund} onChange={(event) => setRefund(event.target.checked)} />
          This is a refund to the customer
        </label>
        <Button
          pending={pending}
          disabled={!amount.trim()}
          onClick={() => {
            const paise = rupeesToPaise(amount);
            run(() => recordPayment(subscriptionId, { amount: refund ? -paise : paise, method, note: note.trim() || undefined }), {
              success: refund ? "Refund recorded" : "Payment recorded; receipt emailed",
              onSuccess: () => {
                setNote("");
                setRefund(false);
              },
            });
          }}
        >
          {refund ? "Record refund" : "Record payment"}
        </Button>
      </div>
    </Card>
  );
}

export function SubscriptionRiderPicker({ subscriptionId, current, riders }: { subscriptionId: string; current: string | null; riders: { id: string; name: string }[] }) {
  const [riderId, setRiderId] = useState(current ?? "");
  const { pending, run } = useAction();
  return (
    <div className="flex gap-2">
      <Select aria-label="Rider" value={riderId} onChange={(event) => setRiderId(event.target.value)}>
        <option value="">No rider</option>
        {riders.map((rider) => (
          <option key={rider.id} value={rider.id}>
            {rider.name}
          </option>
        ))}
      </Select>
      <Button
        variant="outline"
        pending={pending}
        disabled={riderId === (current ?? "")}
        onClick={() => run(() => assignSubscriptionRider(subscriptionId, riderId || null), { success: riderId ? "Rider assigned and sent the schedule link" : "Rider removed" })}
      >
        Save
      </Button>
    </div>
  );
}
