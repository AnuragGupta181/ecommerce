"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProduct, saveProduct } from "@/app/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { Switch } from "@/components/ui/switch";
import { paiseToRupees, rupeesToPaise } from "@/lib/format";
import type { Brand, Category, ProductDetail, ProductInput } from "@/lib/types";
import { useAction } from "@/lib/use-action";

type VariantDraft = {
  id?: string;
  sku: string;
  label: string;
  attributes: string;
  mrp: string;
  price: string;
  stock: string;
  lowStockThreshold: string;
  isActive: boolean;
  existingStock?: number;
};

const emptyVariant = (): VariantDraft => ({ sku: "", label: "Default", attributes: "", mrp: "", price: "", stock: "0", lowStockThreshold: "5", isActive: true });

/** "Colour: Black, Storage: 128 GB" ⇄ { Colour: "Black", Storage: "128 GB" } */
function parseAttributes(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split(",")
      .map((pair) => pair.split(":").map((part) => part.trim()))
      .filter((pair): pair is [string, string] => pair.length === 2 && !!pair[0] && !!pair[1]),
  );
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ProductForm({ product, categories, brands }: { product: ProductDetail | null; categories: Category[]; brands: Brand[] }) {
  const router = useRouter();
  const { pending, fieldErrors, run } = useAction();

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [highlights, setHighlights] = useState((product?.highlights ?? []).join("\n"));
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));
  const [specs, setSpecs] = useState(product?.specs ?? []);
  const [images, setImages] = useState<string[]>(product?.images.map((image) => image.url) ?? [""]);
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      label: variant.label,
      attributes: Object.entries(variant.attributes ?? {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(", "),
      mrp: paiseToRupees(variant.mrp),
      price: paiseToRupees(variant.price),
      stock: String(variant.stock),
      lowStockThreshold: String(variant.lowStockThreshold),
      isActive: variant.isActive,
      existingStock: variant.stock,
    })) ?? [emptyVariant()],
  );

  const updateVariant = (index: number, patch: Partial<VariantDraft>) =>
    setVariants((current) => current.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));

  function submit() {
    const input: ProductInput = {
      name,
      description,
      categoryId,
      brandId: brandId || null,
      isActive,
      isFeatured,
      highlights: lines(highlights),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      specs: specs.filter((spec) => spec.label.trim() && spec.value.trim()),
      images: images.filter(Boolean).map((url) => ({ url })),
      variants: variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        label: variant.label || "Default",
        attributes: parseAttributes(variant.attributes),
        mrp: rupeesToPaise(variant.mrp || "0"),
        price: rupeesToPaise(variant.price || "0"),
        stock: Number(variant.stock) || 0,
        lowStockThreshold: Number(variant.lowStockThreshold) || 0,
        isActive: variant.isActive,
      })),
    };
    run(() => saveProduct(product?.id ?? null, input), {
      success: product ? "Product saved" : "Product created",
      onSuccess: ({ id }) => (product ? router.refresh() : router.push(`/products/${id}`)),
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-6 xl:grid-cols-3"
    >
      <div className="flex flex-col gap-6 xl:col-span-2">
        <Card title="Details">
          <div className="grid gap-4 p-5">
            <Field label="Name" htmlFor="name" error={fieldErrors.name}>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Description" htmlFor="description" error={fieldErrors.description}>
              <Textarea id="description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <Field label="Highlights" htmlFor="highlights" hint="One per line, shown as bullet points" error={fieldErrors.highlights}>
              <Textarea id="highlights" rows={4} value={highlights} onChange={(event) => setHighlights(event.target.value)} />
            </Field>
            <Field label="Search tags" htmlFor="tags" hint="Comma separated" error={fieldErrors.tags}>
              <Input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Variants" actions={<Button size="sm" variant="outline" onClick={() => setVariants((current) => [...current, emptyVariant()])}><Plus size={14} /> Add variant</Button>}>
          <div className="flex flex-col divide-y divide-line">
            {fieldErrors.variants ? <p className="px-5 pt-3 text-xs text-danger">{fieldErrors.variants}</p> : null}
            {variants.map((variant, index) => (
              <div key={variant.id ?? `new-${index}`} className="grid gap-3 p-5 sm:grid-cols-6">
                <Field label="SKU" htmlFor={`sku-${index}`} error={fieldErrors[`variants.${index}.sku`]}>
                  <Input id={`sku-${index}`} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} required />
                </Field>
                <Field label="Label" htmlFor={`label-${index}`}>
                  <Input id={`label-${index}`} value={variant.label} onChange={(event) => updateVariant(index, { label: event.target.value })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Attributes" htmlFor={`attrs-${index}`} hint="e.g. Colour: Black, Size: M">
                    <Input id={`attrs-${index}`} value={variant.attributes} onChange={(event) => updateVariant(index, { attributes: event.target.value })} />
                  </Field>
                </div>
                <Field label="MRP (₹)" htmlFor={`mrp-${index}`} error={fieldErrors[`variants.${index}.mrp`]}>
                  <Input id={`mrp-${index}`} inputMode="decimal" value={variant.mrp} onChange={(event) => updateVariant(index, { mrp: event.target.value })} required />
                </Field>
                <Field label="Price (₹)" htmlFor={`price-${index}`} error={fieldErrors[`variants.${index}.price`]}>
                  <Input id={`price-${index}`} inputMode="decimal" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} required />
                </Field>
                <Field label={variant.id ? "Stock" : "Opening stock"} htmlFor={`stock-${index}`} hint={variant.id ? "Change in Inventory" : undefined}>
                  <Input id={`stock-${index}`} inputMode="numeric" value={variant.stock} disabled={!!variant.id} onChange={(event) => updateVariant(index, { stock: event.target.value })} />
                </Field>
                <Field label="Low-stock alert" htmlFor={`low-${index}`}>
                  <Input id={`low-${index}`} inputMode="numeric" value={variant.lowStockThreshold} onChange={(event) => updateVariant(index, { lowStockThreshold: event.target.value })} />
                </Field>
                <div className="flex items-end gap-4 sm:col-span-4">
                  <Switch checked={variant.isActive} onChange={(checked) => updateVariant(index, { isActive: checked })} label="Active" />
                  {variants.length > 1 ? (
                    <Button size="sm" variant="ghost" onClick={() => setVariants((current) => current.filter((_, i) => i !== index))}>
                      <Trash2 size={14} /> Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Specifications" actions={<Button size="sm" variant="outline" onClick={() => setSpecs((current) => [...current, { label: "", value: "" }])}><Plus size={14} /> Add row</Button>}>
          <div className="flex flex-col gap-2 p-5">
            {specs.length === 0 ? <p className="text-ink-500">No specifications yet.</p> : null}
            {specs.map((spec, index) => (
              <div key={index} className="flex gap-2">
                <Input aria-label="Label" placeholder="Label" value={spec.label} className="max-w-56" onChange={(event) => setSpecs((current) => current.map((row, i) => (i === index ? { ...row, label: event.target.value } : row)))} />
                <Input aria-label="Value" placeholder="Value" value={spec.value} onChange={(event) => setSpecs((current) => current.map((row, i) => (i === index ? { ...row, value: event.target.value } : row)))} />
                <Button variant="ghost" aria-label="Remove row" onClick={() => setSpecs((current) => current.filter((_, i) => i !== index))}>
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card title="Organisation">
          <div className="grid gap-4 p-5">
            <Field label="Category" htmlFor="category" error={fieldErrors.categoryId}>
              <Select id="category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parent ? `${category.parent.name} › ` : ""}
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Brand" htmlFor="brand" error={fieldErrors.brandId}>
              <Select id="brand" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                <option value="">No brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Switch checked={isActive} onChange={setIsActive} label="Visible in the store" />
            <Switch checked={isFeatured} onChange={setIsFeatured} label="Featured on home" />
          </div>
        </Card>

        <Card title="Images" actions={<Button size="sm" variant="outline" onClick={() => setImages((current) => [...current, ""])}><Plus size={14} /> Add</Button>}>
          <div className="flex flex-col gap-4 p-5">
            {images.map((url, index) => (
              <ImagePicker key={index} value={url} label={`Image ${index + 1}`} onChange={(next) => setImages((current) => current.map((value, i) => (i === index ? next : value)))} />
            ))}
            <p className="text-xs text-ink-500">The first image is the cover.</p>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" pending={pending} className="flex-1">
            {product ? "Save changes" : "Create product"}
          </Button>
          {product ? (
            <ConfirmAction
              label="Delete"
              size="md"
              title="Delete product?"
              description="Products that appear in orders are archived instead, so order history stays intact."
              confirmLabel="Delete"
              success="Product removed"
              action={() => deleteProduct(product.id)}
              onDone={() => router.push("/products")}
            />
          ) : null}
        </div>
      </div>
    </form>
  );
}
