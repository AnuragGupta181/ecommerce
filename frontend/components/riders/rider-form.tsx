"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { saveRider } from "@/app/(dashboard)/riders/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { titleCase } from "@/lib/format";
import { VEHICLE_TYPES, type Rider, type RiderInput } from "@/lib/types";
import { useAction } from "@/lib/use-action";

function toInput(rider: Rider | null): RiderInput {
  return {
    name: rider?.name ?? "",
    phone: rider?.phone ?? "",
    whatsapp: rider?.whatsapp ?? "",
    email: rider?.email ?? "",
    vehicleType: rider?.vehicleType ?? "BIKE",
    vehicleNumber: rider?.vehicleNumber ?? "",
    idProofType: rider?.idProofType ?? "",
    idProofNumber: rider?.idProofNumber ?? "",
    address: rider?.address ?? "",
    notes: rider?.notes ?? "",
    isActive: rider?.isActive ?? true,
  };
}

/** Opens a modal to register a new rider or edit an existing one. */
export function RiderFormButton({ rider }: { rider: Rider | null }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<RiderInput>(toInput(rider));
  const { pending, fieldErrors, setFieldErrors, run } = useAction();
  const patch = (change: Partial<RiderInput>) => setInput((current) => ({ ...current, ...change }));
  const text = (key: keyof RiderInput) => ({
    id: `rider-${key}`,
    value: String(input[key] ?? ""),
    onChange: (event: { target: { value: string } }) => patch({ [key]: event.target.value }),
  });

  return (
    <>
      <Button
        size={rider ? "sm" : "md"}
        variant={rider ? "outline" : "primary"}
        onClick={() => {
          setInput(toInput(rider));
          setFieldErrors({});
          setOpen(true);
        }}
      >
        {rider ? <Pencil size={14} /> : <Plus size={16} />} {rider ? "Edit" : "Register rider"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={rider ? "Edit rider" : "Register rider"}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button pending={pending} onClick={() => run(() => saveRider(rider?.id ?? null, input), { success: rider ? "Rider updated" : "Rider registered", onSuccess: () => setOpen(false) })}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="rider-name" error={fieldErrors.name}>
            <Input {...text("name")} />
          </Field>
          <Field label="Phone" htmlFor="rider-phone" error={fieldErrors.phone} hint="10-digit mobile number">
            <Input {...text("phone")} inputMode="tel" />
          </Field>
          <Field label="WhatsApp" htmlFor="rider-whatsapp" error={fieldErrors.whatsapp} hint="Leave empty to use the phone number">
            <Input {...text("whatsapp")} inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="rider-email" error={fieldErrors.email}>
            <Input {...text("email")} type="email" />
          </Field>
          <Field label="Vehicle" htmlFor="rider-vehicleType">
            <Select id="rider-vehicleType" value={input.vehicleType} onChange={(event) => patch({ vehicleType: event.target.value as RiderInput["vehicleType"] })}>
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {titleCase(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vehicle number" htmlFor="rider-vehicleNumber" error={fieldErrors.vehicleNumber}>
            <Input {...text("vehicleNumber")} />
          </Field>
          <Field label="ID proof type" htmlFor="rider-idProofType" hint="Aadhaar, driving licence…">
            <Input {...text("idProofType")} />
          </Field>
          <Field label="ID proof number" htmlFor="rider-idProofNumber">
            <Input {...text("idProofNumber")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" htmlFor="rider-address">
              <Textarea {...text("address")} rows={2} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor="rider-notes">
              <Textarea {...text("notes")} rows={2} />
            </Field>
          </div>
          <Switch checked={input.isActive} onChange={(isActive) => patch({ isActive })} label="Active (can be assigned orders)" />
        </div>
      </Modal>
    </>
  );
}
