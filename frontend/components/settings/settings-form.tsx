"use client";

import { useState } from "react";
import { saveSettings } from "@/app/(dashboard)/marketing-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { paiseToRupees, rupeesToPaise } from "@/lib/format";
import type { Settings } from "@/lib/types";
import { useAction } from "@/lib/use-action";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState({
    ...settings,
    deliveryFee: paiseToRupees(settings.deliveryFee),
    freeDeliveryThreshold: paiseToRupees(settings.freeDeliveryThreshold),
    coinEarnPer100: String(settings.coinEarnPer100),
    coinMaxRedeemPercent: String(settings.coinMaxRedeemPercent),
    returnWindowDays: String(settings.returnWindowDays),
  });
  const { pending, fieldErrors, run } = useAction();
  type Form = typeof form;
  const patch = (change: Partial<Form>) => setForm((current) => ({ ...current, ...change }));
  const text = (key: keyof Form) => ({ id: `s-${key}`, value: String(form[key]), onChange: (event: { target: { value: string } }) => patch({ [key]: event.target.value }) });

  function submit() {
    run(
      () =>
        saveSettings({
          ...form,
          deliveryFee: rupeesToPaise(form.deliveryFee || "0"),
          freeDeliveryThreshold: rupeesToPaise(form.freeDeliveryThreshold || "0"),
          coinEarnPer100: Number(form.coinEarnPer100) || 0,
          coinMaxRedeemPercent: Number(form.coinMaxRedeemPercent) || 0,
          returnWindowDays: Number(form.returnWindowDays) || 0,
        }),
      { success: "Settings saved" },
    );
  }

  return (
    <form
      className="grid gap-6 xl:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Card title="Store">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Store name" htmlFor="s-storeName" error={fieldErrors.storeName}>
            <Input {...text("storeName")} />
          </Field>
          <Field label="Support email" htmlFor="s-supportEmail" error={fieldErrors.supportEmail}>
            <Input {...text("supportEmail")} type="email" />
          </Field>
          <Field label="Support phone" htmlFor="s-supportPhone" error={fieldErrors.supportPhone}>
            <Input {...text("supportPhone")} />
          </Field>
        </div>
      </Card>

      <Card title="Admin alerts">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Admin email" htmlFor="s-adminEmail" hint="Receives order and rider alerts" error={fieldErrors.adminEmail}>
            <Input {...text("adminEmail")} type="email" />
          </Field>
          <Field label="Admin WhatsApp" htmlFor="s-adminWhatsapp" hint="With country code, e.g. +9198…" error={fieldErrors.adminWhatsapp}>
            <Input {...text("adminWhatsapp")} />
          </Field>
        </div>
      </Card>

      <Card title="Delivery and returns">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Delivery fee (₹)" htmlFor="s-deliveryFee" error={fieldErrors.deliveryFee}>
            <Input {...text("deliveryFee")} inputMode="decimal" />
          </Field>
          <Field label="Free delivery above (₹)" htmlFor="s-freeDeliveryThreshold" error={fieldErrors.freeDeliveryThreshold}>
            <Input {...text("freeDeliveryThreshold")} inputMode="decimal" />
          </Field>
          <Field label="Return window (days)" htmlFor="s-returnWindowDays" error={fieldErrors.returnWindowDays}>
            <Input {...text("returnWindowDays")} inputMode="numeric" />
          </Field>
        </div>
      </Card>

      <Card title="Coins and payments">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Coins earned per ₹100" htmlFor="s-coinEarnPer100" error={fieldErrors.coinEarnPer100}>
            <Input {...text("coinEarnPer100")} inputMode="numeric" />
          </Field>
          <Field label="Max order % payable with coins" htmlFor="s-coinMaxRedeemPercent" error={fieldErrors.coinMaxRedeemPercent}>
            <Input {...text("coinMaxRedeemPercent")} inputMode="numeric" />
          </Field>
          <Switch checked={form.codEnabled} onChange={(codEnabled) => patch({ codEnabled })} label="Cash on delivery" />
          <Switch checked={form.upiOnDeliveryEnabled} onChange={(upiOnDeliveryEnabled) => patch({ upiOnDeliveryEnabled })} label="UPI on delivery" />
        </div>
      </Card>

      <div className="xl:col-span-2">
        <Button type="submit" pending={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
