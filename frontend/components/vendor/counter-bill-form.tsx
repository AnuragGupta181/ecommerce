"use client";

import { FileText, Minus, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { createCounterSale, findListings } from "@/app/vendor/(portal)/counter/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { downloadHref } from "@/lib/download-href";
import { formatINR } from "@/lib/format";
import type { Listing, PayMethod } from "@/lib/marketplace-types";
import { useAction } from "@/lib/use-action";

type Line = { listing: Listing; quantity: number };

/**
 * A bill for a customer at the shop counter. The total shown here is only a preview of
 * listing price × quantity; the server computes the bill and deducts the stock.
 */
export function CounterBillButton({ branches }: { branches: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Listing[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [created, setCreated] = useState<{ id: string; number: string; total: number } | null>(null);
  const search = useAction();
  const save = useAction();

  function reset() {
    setQuery("");
    setResults([]);
    setLines([]);
    setMethod("CASH");
    setCustomerName("");
    setCustomerPhone("");
    setCreated(null);
  }

  function add(listing: Listing) {
    setLines((current) =>
      current.some((line) => line.listing.id === listing.id)
        ? current.map((line) => (line.listing.id === listing.id ? { ...line, quantity: line.quantity + 1 } : line))
        : [...current, { listing, quantity: 1 }],
    );
  }

  const setQuantity = (id: string, quantity: number) =>
    setLines((current) => current.flatMap((line) => (line.listing.id !== id ? [line] : quantity > 0 ? [{ ...line, quantity }] : [])));
  const preview = lines.reduce((sum, line) => sum + line.listing.price * line.quantity, 0);

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Receipt size={16} /> New bill
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={created ? `Bill ${created.number}` : "New counter bill"}
        wide
        footer={
          created ? (
            <>
              <a href={downloadHref("/vendor/download", `/documents/bill/${created.id}`)} className="inline-flex h-10 items-center gap-2 rounded-control border border-line px-4 font-semibold hover:bg-brand-50">
                <FileText size={14} /> Download PDF
              </a>
              <Button onClick={reset}>Next bill</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                pending={save.pending}
                disabled={lines.length === 0}
                onClick={() =>
                  save.run(
                    () =>
                      createCounterSale({
                        branchId,
                        items: lines.map((line) => ({ listingId: line.listing.id, quantity: line.quantity })),
                        customerName: customerName.trim() || undefined,
                        customerPhone: customerPhone.trim() || undefined,
                        method,
                      }),
                    { success: "Bill saved and stock updated", onSuccess: setCreated },
                  )
                }
              >
                Save bill
              </Button>
            </>
          )
        }
      >
        {created ? (
          <p className="text-base">
            Total <span className="font-bold">{formatINR(created.total)}</span> received by {method.toLowerCase()}.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {branches.length > 1 ? (
                <Select aria-label="Branch" value={branchId} onChange={(event) => setBranchId(event.target.value)} className="w-auto">
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              <form
                className="flex flex-1 gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (query.trim()) search.run(() => findListings(query.trim(), branchId), { onSuccess: setResults });
                }}
              >
                <Input aria-label="Find an item" placeholder="Item name or SKU" value={query} onChange={(event) => setQuery(event.target.value)} />
                <Button type="submit" variant="outline" pending={search.pending}>
                  <Search size={14} /> Find
                </Button>
              </form>
            </div>
            {results.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {results.map((listing) => (
                  <li key={listing.id}>
                    <button
                      type="button"
                      disabled={listing.stock === 0}
                      onClick={() => add(listing)}
                      className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-brand-50 disabled:opacity-50"
                    >
                      {listing.product.name} · {listing.variant.label} · {formatINR(listing.price)} ({listing.stock} left)
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {lines.length === 0 ? (
              <p className="rounded-control border border-dashed border-line p-4 text-center text-ink-500">Find items and tap them to add to the bill.</p>
            ) : (
              <ul className="flex flex-col rounded-control border border-line">
                {lines.map((line) => (
                  <li key={line.listing.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <span className="min-w-0">
                      <span className="font-semibold">{line.listing.product.name}</span>
                      <span className="block text-xs text-ink-500">
                        {line.listing.variant.label} · {formatINR(line.listing.price)} each
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" aria-label="One less" onClick={() => setQuantity(line.listing.id, line.quantity - 1)}>
                        {line.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                      </Button>
                      <span className="tabular w-6 text-center font-bold">{line.quantity}</span>
                      <Button size="sm" variant="ghost" aria-label="One more" disabled={line.quantity >= line.listing.stock} onClick={() => setQuantity(line.listing.id, line.quantity + 1)}>
                        <Plus size={14} />
                      </Button>
                      <span className="tabular w-20 text-right font-semibold">{formatINR(line.listing.price * line.quantity)}</span>
                    </span>
                  </li>
                ))}
                <li className="flex justify-between bg-canvas px-3 py-2 font-bold">
                  <span>Total</span>
                  <span className="tabular">{formatINR(preview)}</span>
                </li>
              </ul>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Paid by" htmlFor="bill-method">
                <Select id="bill-method" value={method} onChange={(event) => setMethod(event.target.value as PayMethod)}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Customer name (optional)" htmlFor="bill-name">
                <Input id="bill-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              </Field>
              <Field label="Phone (optional)" htmlFor="bill-phone" error={save.fieldErrors.customerPhone}>
                <Input id="bill-phone" inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
