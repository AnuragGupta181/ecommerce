"use client";

import { useState, type ReactNode } from "react";
import { useAction } from "@/lib/use-action";
import { Button } from "./button";
import { Modal } from "./modal";

type Result = { ok: true; data: unknown } | { ok: false; message: string };

/** A button that asks before running a destructive Server Action. */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel = "Confirm",
  success,
  action,
  variant = "danger",
  size = "sm",
  children,
  onDone,
}: {
  label: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  success: string;
  action: () => Promise<Result>;
  variant?: "danger" | "outline" | "primary";
  size?: "sm" | "md";
  children?: ReactNode;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={variant === "danger" ? "secondary" : "primary"}
              pending={pending}
              onClick={() =>
                run(action, {
                  success,
                  onSuccess: () => {
                    setOpen(false);
                    onDone?.();
                  },
                })
              }
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-ink-700">{description}</p>
        {children}
      </Modal>
    </>
  );
}
