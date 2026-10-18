"use client";

import { Pencil, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { addStaff, saveBranch, saveShopProfile, setBranchOnline } from "@/app/vendor/(portal)/shop/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { ImagePicker } from "@/components/ui/image-picker";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { paiseToRupees, rupeesToPaise } from "@/lib/format";
import type { Branch, BranchInput, Vendor, VendorProfileInput } from "@/lib/marketplace-types";
import { useAction } from "@/lib/use-action";

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

export function ShopProfileForm({ vendor, canEdit }: { vendor: Vendor; canEdit: boolean }) {
  const [input, setInput] = useState({
    shopName: vendor.shopName,
    description: vendor.description,
    logoUrl: vendor.logoUrl ?? "",
    phone: vendor.phone,
    email: vendor.email,
    address: vendor.address,
    gstin: vendor.gstin ?? "",
    payoutUpi: vendor.payoutUpi ?? "",
    payoutDetails: vendor.payoutDetails ?? "",
    subscriptionsEnabled: vendor.subscriptionsEnabled,
  });
  const { pending, fieldErrors, run } = useAction();
  const text = (key: Exclude<keyof typeof input, "subscriptionsEnabled">) => ({
    id: `shop-${key}`,
    value: input[key],
    disabled: !canEdit,
    onChange: (event: { target: { value: string } }) => setInput((current) => ({ ...current, [key]: event.target.value })),
  });

  function submit() {
    const payload: VendorProfileInput = {
      ...input,
      logoUrl: blankToNull(input.logoUrl),
      gstin: blankToNull(input.gstin),
      payoutUpi: blankToNull(input.payoutUpi),
      payoutDetails: blankToNull(input.payoutDetails),
    };
    run(() => saveShopProfile(payload), { success: "Shop details saved" });
  }

  return (
    <Card title="Shop details">
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Shop name" htmlFor="shop-shopName" error={fieldErrors.shopName}>
          <Input {...text("shopName")} />
        </Field>
        <Field label="GSTIN (optional)" htmlFor="shop-gstin" error={fieldErrors.gstin}>
          <Input {...text("gstin")} />
        </Field>
        <Field label="Phone" htmlFor="shop-phone" error={fieldErrors.phone}>
          <Input {...text("phone")} inputMode="tel" />
        </Field>
        <Field label="Email" htmlFor="shop-email" error={fieldErrors.email}>
          <Input {...text("email")} type="email" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address" htmlFor="shop-address" error={fieldErrors.address}>
            <Input {...text("address")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="About the shop" htmlFor="shop-description">
            <Textarea {...text("description")} rows={2} />
          </Field>
        </div>
        <Field label="UPI ID for payouts" htmlFor="shop-payoutUpi" error={fieldErrors.payoutUpi}>
          <Input {...text("payoutUpi")} placeholder="shop@upi" />
        </Field>
        <Field label="Bank details (optional)" htmlFor="shop-payoutDetails">
          <Input {...text("payoutDetails")} placeholder="A/c, IFSC" />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-semibold text-ink-700">Logo</p>
          <ImagePicker value={input.logoUrl} onChange={(logoUrl) => setInput((current) => ({ ...current, logoUrl }))} label="Logo" portal="vendor" />
        </div>
        <Switch
          checked={input.subscriptionsEnabled}
          disabled={!canEdit}
          onChange={(subscriptionsEnabled) => setInput((current) => ({ ...current, subscriptionsEnabled }))}
          label="Offer daily needs subscriptions (milk, curd, bread…)"
        />
      </div>
      {canEdit ? (
        <div className="flex justify-end border-t border-line px-5 py-3">
          <Button pending={pending} onClick={submit}>
            Save details
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

type BranchDraft = Record<"name" | "address" | "city" | "state" | "pincode" | "lat" | "lng" | "phone" | "deliveryRadiusKm" | "deliveryRatePerKm" | "minDeliveryFee" | "freeDeliveryAbove" | "opensAt" | "closesAt", string>;

function branchDraft(branch: Branch | null): BranchDraft {
  return {
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    city: branch?.city ?? "",
    state: branch?.state ?? "",
    pincode: branch?.pincode ?? "",
    lat: branch ? String(branch.lat) : "",
    lng: branch ? String(branch.lng) : "",
    phone: branch?.phone ?? "",
    deliveryRadiusKm: String(branch?.deliveryRadiusKm ?? 5),
    deliveryRatePerKm: paiseToRupees(branch?.deliveryRatePerKm ?? 1000),
    minDeliveryFee: paiseToRupees(branch?.minDeliveryFee ?? 2000),
    freeDeliveryAbove: branch?.freeDeliveryAbove != null ? paiseToRupees(branch.freeDeliveryAbove) : "",
    opensAt: branch?.opensAt ?? "08:00",
    closesAt: branch?.closesAt ?? "21:00",
  };
}

function branchInput(draft: BranchDraft): BranchInput {
  return {
    name: draft.name,
    address: draft.address,
    city: draft.city,
    state: draft.state,
    pincode: draft.pincode,
    lat: Number(draft.lat),
    lng: Number(draft.lng),
    phone: blankToNull(draft.phone),
    deliveryRadiusKm: Number(draft.deliveryRadiusKm) || 0,
    deliveryRatePerKm: rupeesToPaise(draft.deliveryRatePerKm || "0"),
    minDeliveryFee: rupeesToPaise(draft.minDeliveryFee || "0"),
    freeDeliveryAbove: draft.freeDeliveryAbove.trim() ? rupeesToPaise(draft.freeDeliveryAbove) : null,
    opensAt: blankToNull(draft.opensAt),
    closesAt: blankToNull(draft.closesAt),
  };
}

/** Branch location, hours and delivery charges. Also used as-is by the public signup page. */
export function BranchFields({ draft, onChange, errors, prefix = "branch" }: { draft: BranchDraft; onChange: (draft: BranchDraft) => void; errors: Record<string, string>; prefix?: string }) {
  const [locating, setLocating] = useState(false);
  const text = (key: keyof BranchDraft) => ({
    id: `${prefix}-${key}`,
    value: draft[key],
    onChange: (event: { target: { value: string } }) => onChange({ ...draft, [key]: event.target.value }),
  });
  const error = (key: string) => errors[key] ?? errors[`branch.${key}`];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Branch name" htmlFor={`${prefix}-name`} error={error("name")} hint="e.g. the area: Hebbal">
        <Input {...text("name")} />
      </Field>
      <Field label="Branch phone (optional)" htmlFor={`${prefix}-phone`} error={error("phone")}>
        <Input {...text("phone")} inputMode="tel" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address" htmlFor={`${prefix}-address`} error={error("address")}>
          <Input {...text("address")} />
        </Field>
      </div>
      <Field label="City" htmlFor={`${prefix}-city`} error={error("city")}>
        <Input {...text("city")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State" htmlFor={`${prefix}-state`} error={error("state")}>
          <Input {...text("state")} />
        </Field>
        <Field label="Pincode" htmlFor={`${prefix}-pincode`} error={error("pincode")}>
          <Input {...text("pincode")} inputMode="numeric" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-3">
        <Field label="Latitude" htmlFor={`${prefix}-lat`} error={error("lat")}>
          <Input {...text("lat")} inputMode="decimal" />
        </Field>
        <Field label="Longitude" htmlFor={`${prefix}-lng`} error={error("lng")}>
          <Input {...text("lng")} inputMode="decimal" />
        </Field>
        <div className="flex items-end">
          <Button
            variant="outline"
            pending={locating}
            className="w-full"
            onClick={() => {
              if (!navigator.geolocation) return;
              setLocating(true);
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  setLocating(false);
                  onChange({ ...draft, lat: position.coords.latitude.toFixed(6), lng: position.coords.longitude.toFixed(6) });
                },
                () => setLocating(false),
                { enableHighAccuracy: true, timeout: 10_000 },
              );
            }}
          >
            Use my location
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Opens (24h)" htmlFor={`${prefix}-opensAt`} error={error("opensAt")}>
          <Input {...text("opensAt")} type="time" />
        </Field>
        <Field label="Closes (24h)" htmlFor={`${prefix}-closesAt`} error={error("closesAt")}>
          <Input {...text("closesAt")} type="time" />
        </Field>
      </div>
      <Field label="Delivers up to (km)" htmlFor={`${prefix}-deliveryRadiusKm`} error={error("deliveryRadiusKm")}>
        <Input {...text("deliveryRadiusKm")} inputMode="decimal" />
      </Field>
      <Field label="Delivery charge per km (₹)" htmlFor={`${prefix}-deliveryRatePerKm`} error={error("deliveryRatePerKm")}>
        <Input {...text("deliveryRatePerKm")} inputMode="decimal" />
      </Field>
      <Field label="Minimum delivery charge (₹)" htmlFor={`${prefix}-minDeliveryFee`} error={error("minDeliveryFee")}>
        <Input {...text("minDeliveryFee")} inputMode="decimal" />
      </Field>
      <Field label="Free delivery above (₹, optional)" htmlFor={`${prefix}-freeDeliveryAbove`} error={error("freeDeliveryAbove")}>
        <Input {...text("freeDeliveryAbove")} inputMode="decimal" />
      </Field>
    </div>
  );
}

export { branchDraft, branchInput, type BranchDraft };

export function BranchFormButton({ branch }: { branch: Branch | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(branchDraft(branch));
  const { pending, fieldErrors, setFieldErrors, run } = useAction();
  return (
    <>
      <Button
        size={branch ? "sm" : "md"}
        variant={branch ? "outline" : "primary"}
        onClick={() => {
          setDraft(branchDraft(branch));
          setFieldErrors({});
          setOpen(true);
        }}
      >
        {branch ? <Pencil size={14} /> : <Plus size={16} />} {branch ? "Edit" : "Add branch"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={branch ? `Edit ${branch.name}` : "New branch"}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button pending={pending} onClick={() => run(() => saveBranch(branch?.id ?? null, branchInput(draft)), { success: "Branch saved", onSuccess: () => setOpen(false) })}>
              Save
            </Button>
          </>
        }
      >
        <BranchFields draft={draft} onChange={setDraft} errors={fieldErrors} />
      </Modal>
    </>
  );
}

export function BranchOnlineSwitch({ branch }: { branch: Branch }) {
  const [message, setMessage] = useState(branch.offlineMessage ?? "");
  const { pending, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <Switch
        checked={branch.isOnline}
        disabled={pending}
        onChange={(isOnline) => run(() => setBranchOnline(branch.id, isOnline, message), { success: isOnline ? "Branch is taking orders" : "Branch closed for orders" })}
        label={branch.isOnline ? "Taking orders" : "Closed for orders"}
      />
      {branch.isOnline ? (
        <Input aria-label="Message when closed" placeholder="Message shown when you close (optional)" value={message} onChange={(event) => setMessage(event.target.value)} />
      ) : branch.offlineMessage ? (
        <p className="text-xs text-ink-500">Customers see: “{branch.offlineMessage}”</p>
      ) : null}
    </div>
  );
}

export function AddStaffButton() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState({ name: "", email: "", phone: "", password: "" });
  const { pending, fieldErrors, run } = useAction();
  const text = (key: keyof typeof input) => ({
    id: `staff-${key}`,
    value: input[key],
    onChange: (event: { target: { value: string } }) => setInput((current) => ({ ...current, [key]: event.target.value })),
  });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus size={14} /> Add staff
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a staff login"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              pending={pending}
              onClick={() =>
                run(() => addStaff(input), {
                  success: "Staff login created",
                  onSuccess: () => {
                    setInput({ name: "", email: "", phone: "", password: "" });
                    setOpen(false);
                  },
                })
              }
            >
              Create login
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <p className="text-ink-700">Staff can manage orders, stock and deliveries, but not staff or shop settings.</p>
          <Field label="Name" htmlFor="staff-name" error={fieldErrors.name}>
            <Input {...text("name")} />
          </Field>
          <Field label="Email" htmlFor="staff-email" error={fieldErrors.email}>
            <Input {...text("email")} type="email" />
          </Field>
          <Field label="Phone" htmlFor="staff-phone" error={fieldErrors.phone}>
            <Input {...text("phone")} inputMode="tel" />
          </Field>
          <Field label="Password" htmlFor="staff-password" error={fieldErrors.password} hint="At least 8 characters. Share it with them privately.">
            <PasswordInput {...text("password")} autoComplete="new-password" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
