"use client";

import { useState, useTransition } from "react";
import { adjustStock, loadMovements, updateThreshold } from "@/app/(dashboard)/inventory/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatDateTime, titleCase } from "@/lib/format";
import type { StockMovement } from "@/lib/types";
import { useAction } from "@/lib/use-action";

type VariantSummary = { id: string; sku: string; name: string; stock: number; lowStockThreshold: number };

export function StockDialog({ variant }: { variant: VariantSummary }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"IN" | "OUT" | "SET">("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [threshold, setThreshold] = useState(String(variant.lowStockThreshold));
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [loading, startLoading] = useTransition();
  const adjust = useAction();
  const alert = useAction();

  function show() {
    setOpen(true);
    setMovements(null);
    startLoading(async () => {
      const result = await loadMovements(variant.id);
      if (result.ok) setMovements(result.data);
    });
  }

  const qty = Number(quantity) || 0;
  const preview = mode === "IN" ? variant.stock + qty : mode === "OUT" ? variant.stock - qty : qty;

  return (
    <>
      <Button size="sm" variant="outline" onClick={show}>
        Adjust
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Adjust stock" wide>
        <div className="flex flex-col gap-6">
          <div>
            <p className="font-semibold">{variant.name}</p>
            <p className="text-xs text-ink-500">
              SKU {variant.sku} · currently <span className="font-semibold text-ink-900">{variant.stock}</span> in stock
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[150px_120px_1fr]">
            <Field label="Action" htmlFor="adj-mode">
              <Select id="adj-mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
                <option value="IN">Add stock</option>
                <option value="OUT">Remove stock</option>
                <option value="SET">Set exact count</option>
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="adj-qty" error={adjust.fieldErrors.quantity}>
              <Input id="adj-qty" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Reason" htmlFor="adj-reason" error={adjust.fieldErrors.reason} hint="Saved in the audit log">
              <Input id="adj-reason" value={reason} placeholder="New shipment, damaged, stock count…" onChange={(event) => setReason(event.target.value)} />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-control bg-canvas px-4 py-3">
            <span className="text-ink-700">
              New stock will be <span className={`font-bold ${preview < 0 ? "text-danger" : "text-ink-900"}`}>{preview}</span>
            </span>
            <Button
              pending={adjust.pending}
              disabled={quantity === "" || preview < 0}
              onClick={() =>
                adjust.run(() => adjustStock(variant.id, { mode, quantity: qty, reason }), {
                  success: "Stock updated",
                  onSuccess: () => setOpen(false),
                })
              }
            >
              Apply
            </Button>
          </div>

          <div className="flex items-end gap-3">
            <Field label="Low-stock alert at" htmlFor="adj-threshold">
              <Input id="adj-threshold" inputMode="numeric" className="w-28" value={threshold} onChange={(event) => setThreshold(event.target.value.replace(/\D/g, ""))} />
            </Field>
            <Button variant="outline" pending={alert.pending} onClick={() => alert.run(() => updateThreshold(variant.id, Number(threshold) || 0), { success: "Alert level saved" })}>
              Save alert level
            </Button>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Movement history</h3>
            {loading || !movements ? (
              <p className="text-ink-500">Loading…</p>
            ) : movements.length === 0 ? (
              <p className="text-ink-500">No movements yet.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-control border border-line">
                {movements.map((movement) => (
                  <li key={movement.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div>
                      <p className="font-semibold">
                        {titleCase(movement.type)}{" "}
                        <span className={movement.quantity >= 0 ? "text-success" : "text-danger"}>
                          {movement.quantity >= 0 ? "+" : ""}
                          {movement.quantity}
                        </span>
                      </p>
                      <p className="text-xs text-ink-500">{movement.reason ?? (movement.orderId ? "Order" : "—")}</p>
                    </div>
                    <div className="text-right text-xs text-ink-500">
                      <p className="tabular">→ {movement.stockAfter}</p>
                      <p>{formatDateTime(movement.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
