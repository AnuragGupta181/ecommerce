import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionRow } from "@/components/ui/option-row";
import { Sheet } from "@/components/ui/sheet";

/** Picks a reason for cancel/return; "Other" asks for free text. */
export function ReasonSheet({
  visible,
  title,
  reasons,
  confirmLabel,
  loading,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  reasons: string[];
  confirmLabel: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [choice, setChoice] = useState<string>();
  const [other, setOther] = useState("");
  const reason = choice === "Other" ? other.trim() : choice;

  return (
    <Sheet visible={visible} title={title} onClose={onClose} footer={<Button title={confirmLabel} variant="secondary" loading={loading} disabled={!reason || reason.length < 3} onPress={() => reason && onConfirm(reason)} />}>
      {[...reasons, "Other"].map((r) => (
        <OptionRow key={r} label={r} selected={choice === r} onPress={() => setChoice(r)} />
      ))}
      {choice === "Other" ? <Input placeholder="Tell us more" value={other} onChangeText={setOther} maxLength={300} multiline /> : null}
    </Sheet>
  );
}
