"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createVendorProduct } from "@/app/vendor/(portal)/stock/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { rupeesToPaise } from "@/lib/format";
import { useAction } from "@/lib/use-action";

type Option = { id: string; name: string };
type VariantDraft = { key: number; label: string; sku: string; mrp: string; price: string; costPrice: string; stock: string };

let nextKey = 1;
const blankVariant = (): VariantDraft => ({ key: nextKey++, label: "", sku: "", mrp: "", price: "", costPrice: "", stock: "0" });

/** A product that is not in the Haat catalog yet, listed at one of the shop's branches in the same step. */
export function VendorProductForm({ branches, categories, brands }: { branches: Option[]; categories: Option[]; brands: Option[] }) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [image, setImage] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([blankVariant()]);
  const { pending, fieldErrors, run } = useAction();

  const patchVariant = (key: number, change: Partial<VariantDraft>) => setVariants((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));

  function submit() {
    run(
      () =>
        createVendorProduct({
          branchId,
          name,
          description,
          categoryId,
          brandId: brandId || null,
          images: image ? [{ url: image }] : [],
          variants: variants.map((row) => ({
            label: row.label.trim() || "Default",
            sku: row.sku.trim(),
            mrp: rupeesToPaise(row.mrp || "0"),
            price: rupeesToPaise(row.price || "0"),
            costPrice: row.costPrice.trim() ? rupeesToPaise(row.costPrice) : null,
            stock: Number(row.stock) || 0,
            lowStockThreshold: 5,
          })),
        }),
      { success: "Product created and listed", onSuccess: () => router.push("/vendor/stock") },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Product">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="product-name" error={fieldErrors.name}>
            <Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          {branches.length > 1 ? (
            <Field label="Sell at" htmlFor="product-branch">
              <Select id="product-branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div />
          )}
          <Field label="Category" htmlFor="product-category" error={fieldErrors.categoryId}>
            <Select id="product-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Brand (optional)" htmlFor="product-brand">
            <Select id="product-brand" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
              <option value="">No brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="product-description" error={fieldErrors.description}>
              <Textarea id="product-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-semibold text-ink-700">Photo</p>
            <ImagePicker value={image} onChange={setImage} label="Product photo" portal="vendor" />
          </div>
        </div>
      </Card>

      <Card
        title="Sizes and prices"
        actions={
          <Button size="sm" variant="outline" onClick={() => setVariants((rows) => [...rows, blankVariant()])}>
            <Plus size={14} /> Add size
          </Button>
        }
      >
        <div className="flex flex-col gap-4 p-5">
          {fieldErrors.variants ? <p className="text-xs text-danger">{fieldErrors.variants}</p> : null}
          {variants.map((row, index) => (
            <div key={row.key} className="grid items-end gap-3 rounded-control border border-line p-3 sm:grid-cols-7">
              <Field label="Size / pack" htmlFor={`v-${row.key}-label`}>
                <Input id={`v-${row.key}-label`} placeholder="500 ml" value={row.label} onChange={(event) => patchVariant(row.key, { label: event.target.value })} />
              </Field>
              <Field label="SKU" htmlFor={`v-${row.key}-sku`} error={fieldErrors[`variants.${index}.sku`]}>
                <Input id={`v-${row.key}-sku`} value={row.sku} onChange={(event) => patchVariant(row.key, { sku: event.target.value })} />
              </Field>
              <Field label="MRP (₹)" htmlFor={`v-${row.key}-mrp`} error={fieldErrors[`variants.${index}.mrp`]}>
                <Input id={`v-${row.key}-mrp`} inputMode="decimal" value={row.mrp} onChange={(event) => patchVariant(row.key, { mrp: event.target.value })} />
              </Field>
              <Field label="Price (₹)" htmlFor={`v-${row.key}-price`} error={fieldErrors[`variants.${index}.price`]}>
                <Input id={`v-${row.key}-price`} inputMode="decimal" value={row.price} onChange={(event) => patchVariant(row.key, { price: event.target.value })} />
              </Field>
              <Field label="Cost (₹)" htmlFor={`v-${row.key}-cost`}>
                <Input id={`v-${row.key}-cost`} inputMode="decimal" value={row.costPrice} onChange={(event) => patchVariant(row.key, { costPrice: event.target.value })} />
              </Field>
              <Field label="Stock" htmlFor={`v-${row.key}-stock`}>
                <Input id={`v-${row.key}-stock`} inputMode="numeric" value={row.stock} onChange={(event) => patchVariant(row.key, { stock: event.target.value.replace(/\D/g, "") })} />
              </Field>
              <Button variant="ghost" disabled={variants.length === 1} aria-label="Remove size" onClick={() => setVariants((rows) => rows.filter((item) => item.key !== row.key))}>
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/vendor/stock")}>
          Cancel
        </Button>
        <Button pending={pending} onClick={submit}>
          Create and list
        </Button>
      </div>
    </div>
  );
}
