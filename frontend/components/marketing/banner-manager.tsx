"use client";

import { Image as ImageIcon, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { deleteBanner, saveBanner } from "@/app/(dashboard)/marketing-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Thumb } from "@/components/ui/thumb";
import { fromLocalInput, toLocalInput } from "@/lib/datetime";
import { formatDate, titleCase } from "@/lib/format";
import type { Banner, BannerInput } from "@/lib/types";
import { useAction } from "@/lib/use-action";

const LINK_HINTS: Record<Banner["linkType"], string> = {
  NONE: "",
  PRODUCT: "Product slug, e.g. iphone-15-128gb",
  CATEGORY: "Category slug, e.g. smartphones",
  SEARCH: "Search text, e.g. running shoes",
  URL: "Full URL, e.g. https://…",
};

const emptyBanner = (): BannerInput => ({
  title: "",
  subtitle: "",
  imageUrl: "",
  linkType: "NONE",
  linkValue: "",
  placement: "HOME_CAROUSEL",
  sortOrder: 0,
  isActive: true,
  startsAt: null,
  endsAt: null,
});

export function BannerManager({ banners }: { banners: Banner[] }) {
  const [editing, setEditing] = useState<{ id: string | null; input: BannerInput } | null>(null);
  const { pending, fieldErrors, setFieldErrors, run } = useAction();
  const patch = (change: Partial<BannerInput>) => setEditing((current) => (current ? { ...current, input: { ...current.input, ...change } } : current));

  function open(banner: Banner | null) {
    setFieldErrors({});
    if (!banner) return setEditing({ id: null, input: emptyBanner() });
    const { id, ...input } = banner;
    setEditing({ id, input });
  }

  return (
    <Card
      title={`${banners.length} banners`}
      actions={
        <Button size="sm" onClick={() => open(null)}>
          <Plus size={14} /> New banner
        </Button>
      }
    >
      {banners.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No banners" description="Add a carousel slide to promote offers on the app home screen." />
      ) : (
        <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {banners.map((banner) => (
            <li key={banner.id} className="overflow-hidden rounded-card border border-line">
              <div className="aspect-[2/1] bg-canvas">
                {banner.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner.imageUrl} alt={banner.title} className="size-full object-cover" />
                ) : (
                  <Thumb src={null} alt="" size={48} />
                )}
              </div>
              <div className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap gap-1">
                  <Badge tone="brand">{titleCase(banner.placement)}</Badge>
                  <Badge tone={banner.isActive ? "success" : "neutral"}>{banner.isActive ? "Active" : "Hidden"}</Badge>
                </div>
                <p className="font-semibold">{banner.title}</p>
                {banner.subtitle ? <p className="text-ink-500">{banner.subtitle}</p> : null}
                <p className="text-xs text-ink-500">
                  Links to {banner.linkType === "NONE" ? "nothing" : `${titleCase(banner.linkType).toLowerCase()} “${banner.linkValue}”`} · order {banner.sortOrder}
                  {banner.endsAt ? ` · ends ${formatDate(banner.endsAt)}` : ""}
                </p>
                <div className="mt-1 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => open(banner)}>
                    <Pencil size={14} /> Edit
                  </Button>
                  <ConfirmAction label="Delete" title="Delete banner?" description="It will disappear from the app immediately." confirmLabel="Delete" success="Banner deleted" action={() => deleteBanner(banner.id)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit banner" : "New banner"}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              pending={pending}
              onClick={() =>
                editing &&
                run(
                  () =>
                    saveBanner(editing.id, {
                      ...editing.input,
                      subtitle: editing.input.subtitle || null,
                      linkValue: editing.input.linkType === "NONE" ? null : editing.input.linkValue || null,
                    }),
                  { success: "Banner saved", onSuccess: () => setEditing(null) },
                )
              }
            >
              Save
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="b-title" error={fieldErrors.title}>
              <Input id="b-title" value={editing.input.title} onChange={(event) => patch({ title: event.target.value })} />
            </Field>
            <Field label="Subtitle" htmlFor="b-subtitle" error={fieldErrors.subtitle}>
              <Input id="b-subtitle" value={editing.input.subtitle ?? ""} onChange={(event) => patch({ subtitle: event.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Image" htmlFor="b-image" error={fieldErrors.imageUrl} hint="Wide image, about 2:1">
                <ImagePicker value={editing.input.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} />
              </Field>
            </div>
            <Field label="Placement" htmlFor="b-placement">
              <Select id="b-placement" value={editing.input.placement} onChange={(event) => patch({ placement: event.target.value as Banner["placement"] })}>
                <option value="HOME_CAROUSEL">Home carousel</option>
                <option value="HOME_STRIP">Home offer strip</option>
              </Select>
            </Field>
            <Field label="Sort order" htmlFor="b-order">
              <Input id="b-order" inputMode="numeric" value={String(editing.input.sortOrder)} onChange={(event) => patch({ sortOrder: Number(event.target.value) || 0 })} />
            </Field>
            <Field label="Tapping opens" htmlFor="b-link-type">
              <Select id="b-link-type" value={editing.input.linkType} onChange={(event) => patch({ linkType: event.target.value as Banner["linkType"] })}>
                {(["NONE", "PRODUCT", "CATEGORY", "SEARCH", "URL"] as const).map((type) => (
                  <option key={type} value={type}>
                    {type === "NONE" ? "Nothing" : titleCase(type)}
                  </option>
                ))}
              </Select>
            </Field>
            {editing.input.linkType !== "NONE" ? (
              <Field label="Link target" htmlFor="b-link" error={fieldErrors.linkValue} hint={LINK_HINTS[editing.input.linkType]}>
                <Input id="b-link" value={editing.input.linkValue ?? ""} onChange={(event) => patch({ linkValue: event.target.value })} />
              </Field>
            ) : (
              <div />
            )}
            <Field label="Show from" htmlFor="b-start">
              <Input id="b-start" type="datetime-local" value={toLocalInput(editing.input.startsAt)} onChange={(event) => patch({ startsAt: fromLocalInput(event.target.value) })} />
            </Field>
            <Field label="Show until" htmlFor="b-end" error={fieldErrors.endsAt}>
              <Input id="b-end" type="datetime-local" value={toLocalInput(editing.input.endsAt)} onChange={(event) => patch({ endsAt: fromLocalInput(event.target.value) })} />
            </Field>
            <Switch checked={editing.input.isActive} onChange={(isActive) => patch({ isActive })} label="Active" />
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
