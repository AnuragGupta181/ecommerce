"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { savePlan } from "@/app/vendor/(portal)/plans/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { paiseToRupees, rupeesToPaise } from "@/lib/format";
import type { DeliveryFeeMode, Period, Plan, PlanPrice } from "@/lib/marketplace-types";
import { useAction } from "@/lib/use-action";

type PriceDraft = { enabled: boolean; pricePerDelivery: string; deliveryFee: string; deliveryFeeMode: DeliveryFeeMode };
type Draft = {
  listingId: string;
  name: string;
  description: string;
  quantityPerDelivery: string;
  slots: string;
  capacity: string;
  isActive: boolean;
  prices: Record<Period, PriceDraft>;
};

const PERIODS: { period: Period; label: string; hint: string }[] = [
  { period: "WEEKLY", label: "Weekly", hint: "Flexible, renews every week" },
  { period: "MONTHLY", label: "Monthly", hint: "Offer a lower price or free delivery to reward commitment" },
];

function priceDraft(price: PlanPrice | undefined): PriceDraft {
  return {
    enabled: !!price,
    pricePerDelivery: price ? paiseToRupees(price.pricePerDelivery) : "",
    deliveryFee: price ? paiseToRupees(price.deliveryFee) : "0",
    deliveryFeeMode: price?.deliveryFeeMode ?? "PER_DELIVERY",
  };
}

function draftOf(plan: Plan | null): Draft {
  return {
    listingId: plan?.listingId ?? "",
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    quantityPerDelivery: String(plan?.quantityPerDelivery ?? 1),
    slots: plan?.slots.join(", ") ?? "6-7 am, 7-8 am",
    capacity: plan?.capacity ? String(plan.capacity) : "",
    isActive: plan?.isActive ?? true,
    prices: {
      WEEKLY: priceDraft(plan?.prices.find((price) => price.period === "WEEKLY")),
      MONTHLY: priceDraft(plan?.prices.find((price) => price.period === "MONTHLY")),
    },
  };
}

export function PlanFormButton({ plan, listings }: { plan: Plan | null; listings: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(draftOf(plan));
  const { pending, fieldErrors, setFieldErrors, run } = useAction();
  const patch = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));
  const patchPrice = (period: Period, change: Partial<PriceDraft>) =>
    setDraft((current) => ({ ...current, prices: { ...current.prices, [period]: { ...current.prices[period], ...change } } }));

  function submit() {
    const terms = {
      name: draft.name,
      description: draft.description,
      quantityPerDelivery: Number(draft.quantityPerDelivery) || 1,
      slots: draft.slots
        .split(",")
        .map((slot) => slot.trim())
        .filter(Boolean),
      capacity: draft.capacity ? Number(draft.capacity) : null,
      isActive: draft.isActive,
      prices: PERIODS.filter(({ period }) => draft.prices[period].enabled).map(({ period }) => ({
        period,
        pricePerDelivery: rupeesToPaise(draft.prices[period].pricePerDelivery || "0"),
        deliveryFee: rupeesToPaise(draft.prices[period].deliveryFee || "0"),
        deliveryFeeMode: draft.prices[period].deliveryFeeMode,
      })),
    };
    run(() => savePlan(plan?.id ?? null, plan ? terms : { ...terms, listingId: draft.listingId }), {
      success: plan ? "Plan updated. Existing subscribers keep their price." : "Plan created",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <>
      <Button
        size={plan ? "sm" : "md"}
        variant={plan ? "outline" : "primary"}
        onClick={() => {
          setDraft(draftOf(plan));
          setFieldErrors({});
          setOpen(true);
        }}
      >
        {plan ? <Pencil size={14} /> : <Plus size={16} />} {plan ? "Edit" : "New plan"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={plan ? `Edit ${plan.name}` : "New subscription plan"}
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
          {plan ? null : (
            <div className="sm:col-span-2">
              <Field label="Product delivered" htmlFor="plan-listing" error={fieldErrors.listingId}>
                <Select id="plan-listing" value={draft.listingId} onChange={(event) => patch({ listingId: event.target.value })}>
                  <option value="">Choose one of your items</option>
                  {listings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <Field label="Plan name" htmlFor="plan-name" error={fieldErrors.name}>
            <Input id="plan-name" placeholder="Morning milk" value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </Field>
          <Field label="Units per delivery" htmlFor="plan-qty" error={fieldErrors.quantityPerDelivery}>
            <Input id="plan-qty" inputMode="numeric" value={draft.quantityPerDelivery} onChange={(event) => patch({ quantityPerDelivery: event.target.value.replace(/\D/g, "") })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="plan-description">
              <Textarea id="plan-description" rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
            </Field>
          </div>
          <Field label="Time slots" htmlFor="plan-slots" hint="Comma separated, e.g. 6-7 am, 7-8 am" error={fieldErrors.slots}>
            <Input id="plan-slots" value={draft.slots} onChange={(event) => patch({ slots: event.target.value })} />
          </Field>
          <Field label="Max subscribers (optional)" htmlFor="plan-capacity" error={fieldErrors.capacity}>
            <Input id="plan-capacity" inputMode="numeric" value={draft.capacity} onChange={(event) => patch({ capacity: event.target.value.replace(/\D/g, "") })} />
          </Field>
          {PERIODS.map(({ period, label, hint }) => {
            const price = draft.prices[period];
            return (
              <div key={period} className="flex flex-col gap-3 rounded-control border border-line p-3 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Switch checked={price.enabled} onChange={(enabled) => patchPrice(period, { enabled })} label={`Offer ${label.toLowerCase()}`} />
                  <span className="text-xs text-ink-500">{hint}</span>
                </div>
                {price.enabled ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Price per delivery (₹)" htmlFor={`plan-${period}-price`}>
                      <Input id={`plan-${period}-price`} inputMode="decimal" value={price.pricePerDelivery} onChange={(event) => patchPrice(period, { pricePerDelivery: event.target.value })} />
                    </Field>
                    <Field label="Delivery fee (₹)" htmlFor={`plan-${period}-fee`} hint="0 for free delivery">
                      <Input id={`plan-${period}-fee`} inputMode="decimal" value={price.deliveryFee} onChange={(event) => patchPrice(period, { deliveryFee: event.target.value })} />
                    </Field>
                    <Field label="Fee charged" htmlFor={`plan-${period}-mode`}>
                      <Select id={`plan-${period}-mode`} value={price.deliveryFeeMode} onChange={(event) => patchPrice(period, { deliveryFeeMode: event.target.value as DeliveryFeeMode })}>
                        <option value="PER_DELIVERY">On every delivery</option>
                        <option value="PER_PERIOD">Once per {period === "WEEKLY" ? "week" : "month"}</option>
                      </Select>
                    </Field>
                  </div>
                ) : null}
              </div>
            );
          })}
          {fieldErrors.prices ? <p className="text-xs text-danger sm:col-span-2">{fieldErrors.prices}</p> : null}
          <Switch checked={draft.isActive} onChange={(isActive) => patch({ isActive })} label="Open for new subscribers" />
        </div>
      </Modal>
    </>
  );
}
