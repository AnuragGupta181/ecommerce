"use client";

import { History, Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";
import { adjustListing, createListing, deleteListing, loadMovements, searchCatalog, updateListing, type ListingTerms } from "@/app/vendor/(portal)/stock/actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Thumb } from "@/components/ui/thumb";
import { formatDateTime, formatINR, paiseToRupees, rupeesToPaise, titleCase } from "@/lib/format";
import type { CatalogProduct, Listing, ListingMovement } from "@/lib/marketplace-types";
import { useAction } from "@/lib/use-action";

/** Form state keeps rupees as text so typing "12.5" never loses precision; it becomes paise on save. */
type TermsDraft = { price: string; mrp: string; costPrice: string; lowStockThreshold: string; isAvailable: boolean };

function draftOf(terms: { price: number; mrp: number; costPrice?: number | null; lowStockThreshold: number; isAvailable: boolean }): TermsDraft {
  return {
    price: paiseToRupees(terms.price),
    mrp: paiseToRupees(terms.mrp),
    costPrice: terms.costPrice != null ? paiseToRupees(terms.costPrice) : "",
    lowStockThreshold: String(terms.lowStockThreshold),
    isAvailable: terms.isAvailable,
  };
}

function termsOf(draft: TermsDraft): ListingTerms {
  return {
    price: rupeesToPaise(draft.price || "0"),
    mrp: rupeesToPaise(draft.mrp || "0"),
    costPrice: draft.costPrice.trim() ? rupeesToPaise(draft.costPrice) : null,
    lowStockThreshold: Number(draft.lowStockThreshold) || 0,
    isAvailable: draft.isAvailable,
  };
}

function TermsFields({ draft, onChange, errors, idPrefix }: { draft: TermsDraft; onChange: (draft: TermsDraft) => void; errors: Record<string, string>; idPrefix: string }) {
  const field = (key: "price" | "mrp" | "costPrice" | "lowStockThreshold") => ({
    id: `${idPrefix}-${key}`,
    value: draft[key],
    inputMode: "decimal" as const,
    onChange: (event: { target: { value: string } }) => onChange({ ...draft, [key]: event.target.value }),
  });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Your price (₹)" htmlFor={`${idPrefix}-price`} error={errors.price}>
        <Input {...field("price")} />
      </Field>
      <Field label="MRP (₹)" htmlFor={`${idPrefix}-mrp`} error={errors.mrp}>
        <Input {...field("mrp")} />
      </Field>
      <Field label="Cost price (₹)" htmlFor={`${idPrefix}-costPrice`} error={errors.costPrice} hint="Private. Used for your profit report.">
        <Input {...field("costPrice")} />
      </Field>
      <Field label="Warn me below" htmlFor={`${idPrefix}-lowStockThreshold`} error={errors.lowStockThreshold} hint="Low stock alert at this many units">
        <Input {...field("lowStockThreshold")} inputMode="numeric" />
      </Field>
      <Switch checked={draft.isAvailable} onChange={(isAvailable) => onChange({ ...draft, isAvailable })} label="Available to customers" />
    </div>
  );
}

export function ListingEditButton({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(draftOf(listing));
  const { pending, fieldErrors, run } = useAction();
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDraft(draftOf(listing));
          setOpen(true);
        }}
      >
        <Pencil size={14} /> Edit
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${listing.product.name} · ${listing.variant.label}`}
        footer={
          <>
            <ConfirmAction
              label="Stop selling"
              title="Stop selling this item?"
              description="It is removed from this shop. Past orders keep their details."
              confirmLabel="Remove"
              success="Removed from your shop"
              action={() => deleteListing(listing.id)}
              onDone={() => setOpen(false)}
            />
            <span className="flex-1" />
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button pending={pending} onClick={() => run(() => updateListing(listing.id, termsOf(draft)), { success: "Saved", onSuccess: () => setOpen(false) })}>
              Save
            </Button>
          </>
        }
      >
        <TermsFields draft={draft} onChange={setDraft} errors={fieldErrors} idPrefix={`listing-${listing.id}`} />
      </Modal>
    </>
  );
}

export function StockAdjustButton({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"IN" | "OUT" | "SET">("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [movements, setMovements] = useState<ListingMovement[] | null>(null);
  const save = useAction();
  const history = useAction();

  function openDialog() {
    setMode("IN");
    setQuantity("");
    setReason("");
    setMovements(null);
    setOpen(true);
    history.run(() => loadMovements(listing.id), { onSuccess: setMovements });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={openDialog}>
        <History size={14} /> Stock
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Stock · ${listing.product.name} ${listing.variant.label}`}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              pending={save.pending}
              disabled={quantity === "" || reason.trim().length < 2}
              onClick={() =>
                save.run(() => adjustListing(listing.id, { mode, quantity: Number(quantity), reason }), {
                  success: "Stock updated",
                  onSuccess: () => {
                    setQuantity("");
                    setReason("");
                    history.run(() => loadMovements(listing.id), { onSuccess: setMovements });
                  },
                })
              }
            >
              Save change
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <p className="text-ink-700">
            Now <span className="text-base font-bold text-ink-900">{listing.stock}</span> in stock at {listing.branch.name}. Online orders, subscription drops and counter bills
            deduct automatically; use this for deliveries from your supplier, damage or a recount.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Change" htmlFor="adjust-mode">
              <Select id="adjust-mode" value={mode} onChange={(event) => setMode(event.target.value as "IN" | "OUT" | "SET")}>
                <option value="IN">Add (received)</option>
                <option value="OUT">Remove (damaged, lost)</option>
                <option value="SET">Set exact count</option>
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="adjust-quantity" error={save.fieldErrors.quantity}>
              <Input id="adjust-quantity" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Reason" htmlFor="adjust-reason" error={save.fieldErrors.reason}>
              <Input id="adjust-reason" value={reason} placeholder="Supplier delivery" onChange={(event) => setReason(event.target.value)} />
            </Field>
          </div>
          <div>
            <p className="mb-2 font-semibold">Stock log</p>
            {movements === null ? (
              <p className="text-ink-500">Loading…</p>
            ) : movements.length === 0 ? (
              <p className="text-ink-500">No changes yet.</p>
            ) : (
              <ul className="flex max-h-64 flex-col overflow-y-auto rounded-control border border-line">
                {movements.map((movement) => (
                  <li key={movement.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <span>
                      <span className="font-semibold">{titleCase(movement.type)}</span>
                      {movement.reason ? <span className="text-ink-700"> · {movement.reason}</span> : null}
                      <span className="block text-xs text-ink-500">{formatDateTime(movement.createdAt)}</span>
                    </span>
                    <span className="tabular text-right">
                      <span className={movement.quantity < 0 ? "text-danger" : "text-success"}>
                        {movement.quantity > 0 ? "+" : ""}
                        {movement.quantity}
                      </span>
                      <span className="block text-xs text-ink-500">→ {movement.stockAfter}</span>
                    </span>
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

/** Find an existing catalog product and start selling one of its variants at a branch. */
export function AddFromCatalogButton({ branches }: { branches: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogProduct[] | null>(null);
  const [picked, setPicked] = useState<{ product: CatalogProduct; variant: CatalogProduct["variants"][number] } | null>(null);
  const [draft, setDraft] = useState<TermsDraft>(draftOf({ price: 0, mrp: 0, lowStockThreshold: 5, isAvailable: true }));
  const [stock, setStock] = useState("0");
  const search = useAction();
  const save = useAction();

  function pick(product: CatalogProduct, variant: CatalogProduct["variants"][number]) {
    setPicked({ product, variant });
    setDraft(draftOf({ price: variant.price, mrp: variant.mrp, lowStockThreshold: 5, isAvailable: true }));
    setStock("0");
  }

  return (
    <>
      <Button
        onClick={() => {
          setPicked(null);
          setResults(null);
          setQuery("");
          setOpen(true);
        }}
      >
        <Plus size={16} /> Add from catalog
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={picked ? `Sell ${picked.product.name} · ${picked.variant.label}` : "Add from the Haat catalog"}
        wide
        footer={
          picked ? (
            <>
              <Button variant="outline" onClick={() => setPicked(null)}>
                Back
              </Button>
              <Button
                pending={save.pending}
                onClick={() =>
                  save.run(() => createListing({ ...termsOf(draft), branchId, variantId: picked.variant.id, stock: Number(stock) || 0 }), {
                    success: "Added to your shop",
                    onSuccess: () => setOpen(false),
                  })
                }
              >
                Start selling
              </Button>
            </>
          ) : undefined
        }
      >
        {picked ? (
          <div className="flex flex-col gap-4">
            <TermsFields draft={draft} onChange={setDraft} errors={save.fieldErrors} idPrefix="new-listing" />
            <Field label="Opening stock" htmlFor="new-listing-stock" error={save.fieldErrors.stock}>
              <Input id="new-listing-stock" inputMode="numeric" value={stock} onChange={(event) => setStock(event.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
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
                  if (query.trim()) search.run(() => searchCatalog(query.trim(), branchId), { onSuccess: setResults });
                }}
              >
                <Input aria-label="Search the catalog" placeholder="Milk, atta, soap…" value={query} onChange={(event) => setQuery(event.target.value)} />
                <Button type="submit" variant="outline" pending={search.pending}>
                  <Search size={14} /> Search
                </Button>
              </form>
            </div>
            {results === null ? (
              <p className="text-ink-500">Search for a product. If it is not in the catalog, create a new product instead.</p>
            ) : results.length === 0 ? (
              <p className="text-ink-500">Nothing found. Try another word, or create a new product.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {results.map((product) => (
                  <li key={product.id} className="flex gap-3 rounded-control border border-line p-3">
                    <Thumb src={product.imageUrl} alt={product.name} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-xs text-ink-500">{product.category.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {product.variants.map((variant) =>
                          variant.listedHere ? (
                            <span key={variant.id} className="rounded-full bg-canvas px-2.5 py-1 text-xs text-ink-500">
                              {variant.label} · already selling
                            </span>
                          ) : (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => pick(product, variant)}
                              className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold hover:bg-brand-50"
                            >
                              {variant.label} · MRP {formatINR(variant.mrp)}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
