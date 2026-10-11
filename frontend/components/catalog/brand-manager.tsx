"use client";

import { Pencil, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { deleteBrand, saveBrand, type BrandInput } from "@/app/(dashboard)/categories/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import type { Brand } from "@/lib/types";
import { useAction } from "@/lib/use-action";

type Editing = { id: string | null; input: BrandInput } | null;

export function BrandManager({ brands }: { brands: Brand[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [query, setQuery] = useState("");
  const { pending, fieldErrors, setFieldErrors, run } = useAction();
  const visible = brands.filter((brand) => brand.name.toLowerCase().includes(query.trim().toLowerCase()));

  function open(brand: Brand | null) {
    setFieldErrors({});
    setEditing({ id: brand?.id ?? null, input: { name: brand?.name ?? "", logoUrl: brand?.logoUrl ?? null, isActive: brand?.isActive ?? true } });
  }

  const patch = (change: Partial<BrandInput>) => setEditing((current) => (current ? { ...current, input: { ...current.input, ...change } } : current));

  return (
    <Card
      title={`${brands.length} brands`}
      actions={
        <div className="flex gap-2">
          <Input aria-label="Filter brands" placeholder="Filter" value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 w-44" />
          <Button size="sm" onClick={() => open(null)}>
            <Plus size={14} /> Add brand
          </Button>
        </div>
      }
    >
      {visible.length === 0 ? (
        <EmptyState icon={Tag} title="No brands" action={<Button onClick={() => open(null)}>Add brand</Button>} />
      ) : (
        <Table>
          <THead>
            <Th>Brand</Th>
            <Th>Slug</Th>
            <Th align="right">Products</Th>
            <Th>Status</Th>
            <Th />
          </THead>
          <tbody>
            {visible.map((brand) => (
              <Tr key={brand.id}>
                <Td>
                  <span className="flex items-center gap-3">
                    <Thumb src={brand.logoUrl} alt={brand.name} size={32} />
                    <span className="font-semibold">{brand.name}</span>
                  </span>
                </Td>
                <Td className="text-ink-500">{brand.slug}</Td>
                <Td numeric>{brand._count.products}</Td>
                <Td>
                  <Badge tone={brand.isActive ? "success" : "neutral"}>{brand.isActive ? "Active" : "Hidden"}</Badge>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => open(brand)}>
                      <Pencil size={14} /> Edit
                    </Button>
                    <ConfirmAction
                      label="Delete"
                      title={`Delete ${brand.name}?`}
                      description="Brands used by products cannot be deleted. Hide them instead."
                      confirmLabel="Delete"
                      success="Brand deleted"
                      action={() => deleteBrand(brand.id)}
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit brand" : "Add brand"}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              pending={pending}
              onClick={() => editing && run(() => saveBrand(editing.id, { ...editing.input, logoUrl: editing.input.logoUrl || null }), { success: "Brand saved", onSuccess: () => setEditing(null) })}
            >
              Save
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="grid gap-4">
            <Field label="Name" htmlFor="brand-name" error={fieldErrors.name}>
              <Input id="brand-name" value={editing.input.name} onChange={(event) => patch({ name: event.target.value })} />
            </Field>
            <Field label="Logo" htmlFor="brand-logo" error={fieldErrors.logoUrl}>
              <ImagePicker value={editing.input.logoUrl ?? ""} onChange={(url) => patch({ logoUrl: url })} />
            </Field>
            <Switch checked={editing.input.isActive} onChange={(isActive) => patch({ isActive })} label="Visible in the store" />
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
