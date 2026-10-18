"use client";

import { useState } from "react";
import { changeVendorStatus, updateVendorTerms, type VendorStatusAction } from "@/app/(dashboard)/vendors/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import type { VendorStatus } from "@/lib/marketplace-types";
import { useAction } from "@/lib/use-action";

const ACTIONS: Record<VendorStatus, { action: VendorStatusAction; label: string; needsReason: boolean; danger: boolean }[]> = {
  PENDING: [
    { action: "approve", label: "Approve", needsReason: false, danger: false },
    { action: "reject", label: "Reject", needsReason: true, danger: true },
  ],
  APPROVED: [{ action: "suspend", label: "Suspend", needsReason: true, danger: true }],
  SUSPENDED: [{ action: "reactivate", label: "Reactivate", needsReason: false, danger: false }],
  REJECTED: [{ action: "approve", label: "Approve after all", needsReason: false, danger: false }],
};

export function VendorStatusButtons({ vendorId, status }: { vendorId: string; status: VendorStatus }) {
  const [pendingAction, setPendingAction] = useState<(typeof ACTIONS)[VendorStatus][number] | null>(null);
  const [reason, setReason] = useState("");
  const { pending, run } = useAction();

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ACTIONS[status].map((option) => (
          <Button
            key={option.action}
            variant={option.danger ? "danger" : "primary"}
            onClick={() => {
              setReason("");
              setPendingAction(option);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <Modal
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={`${pendingAction?.label ?? ""} this shop?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              variant={pendingAction?.danger ? "secondary" : "primary"}
              pending={pending}
              disabled={!!pendingAction?.needsReason && reason.trim().length < 3}
              onClick={() =>
                pendingAction &&
                run(() => changeVendorStatus(vendorId, pendingAction.action, reason.trim()), { success: "Shop updated; the owner has been emailed", onSuccess: () => setPendingAction(null) })
              }
            >
              {pendingAction?.label}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-ink-700">
          {pendingAction?.action === "approve" || pendingAction?.action === "reactivate"
            ? "The shop becomes visible to customers and can take orders."
            : "The shop is hidden from customers and becomes read-only. The owner sees your reason."}
        </p>
        {pendingAction?.needsReason ? <Textarea aria-label="Reason" rows={3} placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} /> : null}
      </Modal>
    </>
  );
}

export function VendorTermsCard({ vendorId, commissionBps, subscriptionsEnabled }: { vendorId: string; commissionBps: number; subscriptionsEnabled: boolean }) {
  const [percent, setPercent] = useState(String(commissionBps / 100));
  const [subscriptions, setSubscriptions] = useState(subscriptionsEnabled);
  const { pending, fieldErrors, run } = useAction();
  // Commission is stored in basis points (1% = 100) so fractional percentages stay integers.
  const bps = Math.round(Number(percent) * 100);

  return (
    <Card title="Terms">
      <div className="flex flex-col gap-3 p-5">
        <Field label="Commission on goods (%)" htmlFor="vendor-commission" error={fieldErrors.commissionBps} hint="Applies to new orders; past orders keep theirs">
          <Input id="vendor-commission" inputMode="decimal" value={percent} onChange={(event) => setPercent(event.target.value)} />
        </Field>
        <Switch checked={subscriptions} onChange={setSubscriptions} label="Allowed to offer subscriptions" />
        <Button
          variant="outline"
          pending={pending}
          disabled={!Number.isFinite(bps) || (bps === commissionBps && subscriptions === subscriptionsEnabled)}
          onClick={() => run(() => updateVendorTerms(vendorId, { commissionBps: bps, subscriptionsEnabled: subscriptions }), { success: "Terms saved" })}
        >
          Save terms
        </Button>
      </div>
    </Card>
  );
}
