"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { BranchFields, branchDraft, branchInput } from "@/components/vendor/shop-forms";
import { useAction } from "@/lib/use-action";
import { signupVendor } from "./actions";

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

export function SignupForm() {
  const [owner, setOwner] = useState({ name: "", email: "", phone: "", password: "" });
  const [shop, setShop] = useState({ shopName: "", phone: "", email: "", address: "", description: "", gstin: "", idProofType: "", idProofNumber: "" });
  const [branch, setBranch] = useState(branchDraft(null));
  const [done, setDone] = useState(false);
  const { pending, fieldErrors, run } = useAction();

  // The API reports nested paths ("owner.email"); each section reads its own.
  const error = (path: string) => fieldErrors[path];
  const ownerText = (key: keyof typeof owner) => ({
    id: `owner-${key}`,
    value: owner[key],
    onChange: (event: { target: { value: string } }) => setOwner((current) => ({ ...current, [key]: event.target.value })),
  });
  const shopText = (key: keyof typeof shop) => ({
    id: `shop-${key}`,
    value: shop[key],
    onChange: (event: { target: { value: string } }) => setShop((current) => ({ ...current, [key]: event.target.value })),
  });

  if (done) {
    return (
      <Card>
        <div className="flex flex-col gap-3 p-6">
          <h2 className="text-lg font-bold">Thanks! Your shop is waiting for approval.</h2>
          <p className="text-ink-700">
            We will email {owner.email} once Haat has checked your details. You can sign in now to add your products and stock; customers will see them after approval.
          </p>
          <Link href="/login" className="inline-flex h-10 w-fit items-center rounded-control bg-brand-500 px-4 font-semibold text-ink-900 hover:bg-brand-400">
            Sign in
          </Link>
        </div>
      </Card>
    );
  }

  const branchErrors = Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([key]) => key.startsWith("branch."))
      .map(([key, value]) => [key.slice("branch.".length), value]),
  );

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            signupVendor({
              owner,
              shop: {
                ...shop,
                gstin: blankToNull(shop.gstin),
                idProofType: blankToNull(shop.idProofType),
                idProofNumber: blankToNull(shop.idProofNumber),
              },
              branch: branchInput(branch),
            }),
          { onSuccess: () => setDone(true) },
        );
      }}
    >
      <Card title="You">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Your name" htmlFor="owner-name" error={error("owner.name")}>
            <Input {...ownerText("name")} autoComplete="name" />
          </Field>
          <Field label="Mobile" htmlFor="owner-phone" error={error("owner.phone")}>
            <Input {...ownerText("phone")} inputMode="tel" autoComplete="tel" />
          </Field>
          <Field label="Email (your login)" htmlFor="owner-email" error={error("owner.email")}>
            <Input {...ownerText("email")} type="email" autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="owner-password" error={error("owner.password")} hint="At least 8 characters">
            <PasswordInput {...ownerText("password")} autoComplete="new-password" />
          </Field>
        </div>
      </Card>
      <Card title="Your shop">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Shop name" htmlFor="shop-shopName" error={error("shop.shopName")}>
            <Input {...shopText("shopName")} />
          </Field>
          <Field label="Shop phone" htmlFor="shop-phone" error={error("shop.phone")}>
            <Input {...shopText("phone")} inputMode="tel" />
          </Field>
          <Field label="Shop email" htmlFor="shop-email" error={error("shop.email")}>
            <Input {...shopText("email")} type="email" />
          </Field>
          <Field label="GSTIN (optional)" htmlFor="shop-gstin" error={error("shop.gstin")}>
            <Input {...shopText("gstin")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Registered address" htmlFor="shop-address" error={error("shop.address")}>
              <Input {...shopText("address")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="What do you sell?" htmlFor="shop-description">
              <Textarea {...shopText("description")} rows={2} />
            </Field>
          </div>
          <Field label="ID proof type (optional)" htmlFor="shop-idProofType" hint="Aadhaar, PAN, shop licence">
            <Input {...shopText("idProofType")} />
          </Field>
          <Field label="ID proof number (optional)" htmlFor="shop-idProofNumber">
            <Input {...shopText("idProofNumber")} />
          </Field>
        </div>
      </Card>
      <Card title="Where you deliver from">
        <div className="p-5">
          <BranchFields draft={branch} onChange={setBranch} errors={branchErrors} prefix="signup-branch" />
        </div>
      </Card>
      <div className="flex items-center justify-between gap-3">
        <Link href="/login" className="font-semibold text-ink-500 hover:text-ink-900">
          Already selling? Sign in
        </Link>
        <Button type="submit" pending={pending}>
          Apply to sell on Haat
        </Button>
      </div>
    </form>
  );
}
