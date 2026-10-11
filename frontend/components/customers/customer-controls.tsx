"use client";

import { Coins } from "lucide-react";
import { useState } from "react";
import { adjustCoins, setCustomerBlocked } from "@/app/(dashboard)/customers/actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useAction } from "@/lib/use-action";

export function CustomerControls({ id, isBlocked }: { id: string; isBlocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const coins = useAction();

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Coins size={16} /> Adjust coins
      </Button>
      <ConfirmAction
        size="md"
        variant={isBlocked ? "outline" : "danger"}
        label={isBlocked ? "Unblock" : "Block"}
        title={isBlocked ? "Unblock customer?" : "Block customer?"}
        description={isBlocked ? "They will be able to sign in and place orders again." : "They will be signed out everywhere and cannot sign in until unblocked."}
        confirmLabel={isBlocked ? "Unblock" : "Block"}
        success={isBlocked ? "Customer unblocked" : "Customer blocked"}
        action={() => setCustomerBlocked(id, !isBlocked)}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Adjust coins"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              pending={coins.pending}
              onClick={() =>
                coins.run(() => adjustCoins(id, Number(amount), note), {
                  success: "Coins updated",
                  onSuccess: () => {
                    setOpen(false);
                    setAmount("");
                    setNote("");
                  },
                })
              }
            >
              Apply
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Amount" htmlFor="coin-amount" hint="Use a negative number to deduct. 1 coin = ₹1." error={coins.fieldErrors.amount}>
            <Input id="coin-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d-]/g, ""))} />
          </Field>
          <Field label="Reason" htmlFor="coin-note" error={coins.fieldErrors.note}>
            <Input id="coin-note" value={note} placeholder="Goodwill credit, correction…" onChange={(event) => setNote(event.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
