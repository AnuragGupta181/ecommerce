"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { createAdmin } from "@/app/(dashboard)/admins/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Modal } from "@/components/ui/modal";
import { useAction } from "@/lib/use-action";

const EMPTY = { name: "", email: "", phone: "", password: "" };

export function AddAdminButton() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(EMPTY);
  const { pending, fieldErrors, run } = useAction();
  const text = (key: keyof typeof EMPTY) => ({
    id: `admin-${key}`,
    value: input[key],
    onChange: (event: { target: { value: string } }) => setInput((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus size={16} /> Add admin
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New admin"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              pending={pending}
              onClick={() =>
                run(() => createAdmin(input), {
                  success: "Admin created",
                  onSuccess: () => {
                    setInput(EMPTY);
                    setOpen(false);
                  },
                })
              }
            >
              Create
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <p className="text-ink-700">Admins manage the whole platform except other admins and the audit log.</p>
          <Field label="Name" htmlFor="admin-name" error={fieldErrors.name}>
            <Input {...text("name")} />
          </Field>
          <Field label="Email" htmlFor="admin-email" error={fieldErrors.email}>
            <Input {...text("email")} type="email" />
          </Field>
          <Field label="Phone (optional)" htmlFor="admin-phone" error={fieldErrors.phone}>
            <Input {...text("phone")} inputMode="tel" />
          </Field>
          <Field label="Password" htmlFor="admin-password" error={fieldErrors.password} hint="At least 8 characters">
            <PasswordInput {...text("password")} autoComplete="new-password" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
