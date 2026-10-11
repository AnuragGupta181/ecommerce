"use client";

import { FolderTree, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { deleteCategory, saveCategory, type CategoryInput } from "@/app/(dashboard)/categories/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import type { Category } from "@/lib/types";
import { useAction } from "@/lib/use-action";

type Editing = { id: string | null; input: CategoryInput } | null;

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const { pending, fieldErrors, setFieldErrors, run } = useAction();
  const parents = categories.filter((category) => !category.parentId);

  // Parents first, each followed by its children.
  const ordered = parents.flatMap((parent) => [parent, ...categories.filter((category) => category.parentId === parent.id)]);

  function open(category: Category | null) {
    setFieldErrors({});
    setEditing({
      id: category?.id ?? null,
      input: {
        name: category?.name ?? "",
        parentId: category?.parentId ?? null,
        imageUrl: category?.imageUrl ?? null,
        sortOrder: category?.sortOrder ?? 0,
        isActive: category?.isActive ?? true,
      },
    });
  }

  const patch = (change: Partial<CategoryInput>) => setEditing((current) => (current ? { ...current, input: { ...current.input, ...change } } : current));

  return (
    <Card
      title={`${categories.length} categories`}
      actions={
        <Button size="sm" onClick={() => open(null)}>
          <Plus size={14} /> Add category
        </Button>
      }
    >
      {categories.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" action={<Button onClick={() => open(null)}>Add category</Button>} />
      ) : (
        <Table>
          <THead>
            <Th>Name</Th>
            <Th>Slug</Th>
            <Th align="right">Products</Th>
            <Th align="right">Order</Th>
            <Th>Status</Th>
            <Th />
          </THead>
          <tbody>
            {ordered.map((category) => (
              <Tr key={category.id}>
                <Td>
                  <span className={`flex items-center gap-3 ${category.parentId ? "pl-8" : ""}`}>
                    <Thumb src={category.imageUrl} alt={category.name} size={32} />
                    <span className={category.parentId ? "" : "font-semibold"}>{category.name}</span>
                  </span>
                </Td>
                <Td className="text-ink-500">{category.slug}</Td>
                <Td numeric>{category._count.products}</Td>
                <Td numeric>{category.sortOrder}</Td>
                <Td>
                  <Badge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "Active" : "Hidden"}</Badge>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => open(category)}>
                      <Pencil size={14} /> Edit
                    </Button>
                    <ConfirmAction
                      label="Delete"
                      title={`Delete ${category.name}?`}
                      description="Categories with products or sub-categories cannot be deleted. Hide them instead."
                      confirmLabel="Delete"
                      success="Category deleted"
                      action={() => deleteCategory(category.id)}
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
        title={editing?.id ? "Edit category" : "Add category"}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              pending={pending}
              onClick={() => editing && run(() => saveCategory(editing.id, { ...editing.input, imageUrl: editing.input.imageUrl || null }), { success: "Category saved", onSuccess: () => setEditing(null) })}
            >
              Save
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="grid gap-4">
            <Field label="Name" htmlFor="cat-name" error={fieldErrors.name}>
              <Input id="cat-name" value={editing.input.name} onChange={(event) => patch({ name: event.target.value })} />
            </Field>
            <Field label="Parent" htmlFor="cat-parent" error={fieldErrors.parentId}>
              <Select id="cat-parent" value={editing.input.parentId ?? ""} onChange={(event) => patch({ parentId: event.target.value || null })}>
                <option value="">None (top-level)</option>
                {parents
                  .filter((parent) => parent.id !== editing.id)
                  .map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Sort order" htmlFor="cat-order" error={fieldErrors.sortOrder}>
              <Input id="cat-order" inputMode="numeric" value={String(editing.input.sortOrder)} onChange={(event) => patch({ sortOrder: Number(event.target.value) || 0 })} />
            </Field>
            <Field label="Image" htmlFor="cat-image" error={fieldErrors.imageUrl}>
              <ImagePicker value={editing.input.imageUrl ?? ""} onChange={(url) => patch({ imageUrl: url })} />
            </Field>
            <Switch checked={editing.input.isActive} onChange={(isActive) => patch({ isActive })} label="Visible in the store" />
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
