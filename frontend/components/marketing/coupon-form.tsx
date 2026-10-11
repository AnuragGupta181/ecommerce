"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { deleteCoupon, saveCoupon } from "@/app/(dashboard)/marketing-actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { fromLocalInput, toLocalInput } from "@/lib/datetime";
import { paiseToRupees, rupeesToPaise } from "@/lib/format";
import type { Coupon } from "@/lib/types";
import { useAction } from "@/lib/use-action";

type Draft = {
  code: string;
  description: string;
  type: "PERCENT" | "FLAT";
  value: string;
  maxDiscount: string;
  minOrderValue: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perUserLimit: string;
  firstOrderOnly: boolean;
  isActive: boolean;
};

function toDraft(coupon: Coupon | null): Draft {
  return {
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    type: coupon?.type ?? "PERCENT",
    value: coupon ? (coupon.type === "FLAT" ? paiseToRupees(coupon.value) : String(coupon.value)) : "",
    maxDiscount: coupon?.maxDiscount ? paiseToRupees(coupon.maxDiscount) : "",
    minOrderValue: coupon ? paiseToRupees(coupon.minOrderValue) : "0",
    startsAt: toLocalInput(coupon?.startsAt ?? null),
    endsAt: toLocalInput(coupon?.endsAt ?? null),
    usageLimit: coupon?.usageLimit ? String(coupon.usageLimit) : "",
    perUserLimit: String(coupon?.perUserLimit ?? 1),
    firstOrderOnly: coupon?.firstOrderOnly ?? false,
    isActive: coupon?.isActive ?? true,
  };
}

export function CouponFormButton({ coupon }: { coupon: Coupon | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(toDraft(coupon));
  const { pending, fieldErrors, setFieldErrors, run } = useAction();
  const patch = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));

  function submit() {
    run(
      () =>
        saveCoupon(coupon?.id ?? null, {
          code: draft.code.trim().toUpperCase(),
          description: draft.description,
          type: draft.type,
          // Percent coupons store a whole percentage; flat coupons store paise.
          value: draft.type === "FLAT" ? rupeesToPaise(draft.value || "0") : Number(draft.value) || 0,
          maxDiscount: draft.type === "PERCENT" && draft.maxDiscount ? rupeesToPaise(draft.maxDiscount) : null,
          minOrderValue: rupeesToPaise(draft.minOrderValue || "0"),
          startsAt: fromLocalInput(draft.startsAt),
          endsAt: fromLocalInput(draft.endsAt),
          usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
          perUserLimit: Number(draft.perUserLimit) || 1,
          firstOrderOnly: draft.firstOrderOnly,
          isActive: draft.isActive,
        }),
      { success: coupon ? "Coupon saved" : "Coupon created", onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <Button
        size={coupon ? "sm" : "md"}
        variant={coupon ? "outline" : "primary"}
        onClick={() => {
          setDraft(toDraft(coupon));
          setFieldErrors({});
          setOpen(true);
        }}
      >
        {coupon ? <Pencil size={14} /> : <Plus size={16} />} {coupon ? "Edit" : "New coupon"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={coupon ? `Edit ${coupon.code}` : "New coupon"}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button pending={pending} onClick={submit}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="c-code" error={fieldErrors.code} hint="3–20 letters, numbers, - or _">
            <Input id="c-code" value={draft.code} className="font-mono uppercase" onChange={(event) => patch({ code: event.target.value })} />
          </Field>
          <Field label="Description" htmlFor="c-desc" error={fieldErrors.description}>
            <Input id="c-desc" value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
          </Field>
          <Field label="Type" htmlFor="c-type">
            <Select id="c-type" value={draft.type} onChange={(event) => patch({ type: event.target.value as Draft["type"] })}>
              <option value="PERCENT">Percentage off</option>
              <option value="FLAT">Flat amount off</option>
            </Select>
          </Field>
          <Field label={draft.type === "PERCENT" ? "Percent off" : "Amount off (₹)"} htmlFor="c-value" error={fieldErrors.value}>
            <Input id="c-value" inputMode="decimal" value={draft.value} onChange={(event) => patch({ value: event.target.value })} />
          </Field>
          {draft.type === "PERCENT" ? (
            <Field label="Max discount (₹)" htmlFor="c-max" hint="Optional cap" error={fieldErrors.maxDiscount}>
              <Input id="c-max" inputMode="decimal" value={draft.maxDiscount} onChange={(event) => patch({ maxDiscount: event.target.value })} />
            </Field>
          ) : null}
          <Field label="Minimum order (₹)" htmlFor="c-min" error={fieldErrors.minOrderValue}>
            <Input id="c-min" inputMode="decimal" value={draft.minOrderValue} onChange={(event) => patch({ minOrderValue: event.target.value })} />
          </Field>
          <Field label="Starts" htmlFor="c-start" error={fieldErrors.startsAt}>
            <Input id="c-start" type="datetime-local" value={draft.startsAt} onChange={(event) => patch({ startsAt: event.target.value })} />
          </Field>
          <Field label="Ends" htmlFor="c-end" error={fieldErrors.endsAt}>
            <Input id="c-end" type="datetime-local" value={draft.endsAt} onChange={(event) => patch({ endsAt: event.target.value })} />
          </Field>
          <Field label="Total uses" htmlFor="c-limit" hint="Empty for unlimited" error={fieldErrors.usageLimit}>
            <Input id="c-limit" inputMode="numeric" value={draft.usageLimit} onChange={(event) => patch({ usageLimit: event.target.value.replace(/\D/g, "") })} />
          </Field>
          <Field label="Uses per customer" htmlFor="c-per-user" error={fieldErrors.perUserLimit}>
            <Input id="c-per-user" inputMode="numeric" value={draft.perUserLimit} onChange={(event) => patch({ perUserLimit: event.target.value.replace(/\D/g, "") })} />
          </Field>
          <Switch checked={draft.firstOrderOnly} onChange={(firstOrderOnly) => patch({ firstOrderOnly })} label="First order only" />
          <Switch checked={draft.isActive} onChange={(isActive) => patch({ isActive })} label="Active" />
        </div>
      </Modal>
    </>
  );
}

export function CouponDeleteButton({ id }: { id: string }) {
  return (
    <ConfirmAction
      label="Delete"
      title="Delete coupon?"
      description="Coupons that were already redeemed are deactivated instead, to keep order history intact."
      confirmLabel="Delete"
      success="Coupon removed"
      action={() => deleteCoupon(id)}
    />
  );
}
