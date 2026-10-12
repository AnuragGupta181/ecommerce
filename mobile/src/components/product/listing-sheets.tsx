import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { OptionRow } from "@/components/ui/option-row";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import type { ListingQuery } from "@/hooks/use-catalog";
import { colors, spacing } from "@/lib/theme";
import type { Facets } from "@/lib/types";

export const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "popular", label: "Popularity" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest first" },
  { value: "discount", label: "Discount" },
  { value: "rating", label: "Customer rating" },
] as const;

export function SortSheet({ visible, value, onClose, onChange }: { visible: boolean; value?: string; onClose: () => void; onChange: (sort: string) => void }) {
  return (
    <Sheet visible={visible} title="Sort by" onClose={onClose}>
      {SORTS.map((sort) => (
        <OptionRow
          key={sort.value}
          label={sort.label}
          selected={(value ?? "relevance") === sort.value}
          onPress={() => {
            onChange(sort.value);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}

type Filters = Pick<ListingQuery, "brand" | "minPrice" | "maxPrice" | "rating" | "discount" | "inStock">;

// Paise boundaries; labels are rupees.
const PRICE_BANDS = [
  { label: "Under ₹500", max: 50_000 },
  { label: "₹500 – ₹1,000", min: 50_000, max: 100_000 },
  { label: "₹1,000 – ₹5,000", min: 100_000, max: 500_000 },
  { label: "Over ₹5,000", min: 500_000 },
];

export function FilterSheet({ visible, value, facets, onClose, onApply }: { visible: boolean; value: Filters; facets?: Facets; onClose: () => void; onApply: (filters: Filters) => void }) {
  const [draft, setDraft] = useState<Filters>(value);
  const brands = new Set(draft.brand?.split(",").filter(Boolean));
  const toggleBrand = (slug: string) => {
    if (brands.has(slug)) brands.delete(slug);
    else brands.add(slug);
    setDraft({ ...draft, brand: [...brands].join(",") || undefined });
  };

  return (
    <Sheet
      visible={visible}
      title="Filters"
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button title="Clear all" variant="outline" style={styles.flex} onPress={() => setDraft({})} />
          <Button
            title="Apply"
            style={styles.flex}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </View>
      }
    >
      <Text variant="h3">Price</Text>
      <View style={styles.chips}>
        {PRICE_BANDS.map((band) => {
          const selected = draft.minPrice === band.min && draft.maxPrice === band.max;
          return <Chip key={band.label} label={band.label} selected={selected} onPress={() => setDraft({ ...draft, minPrice: selected ? undefined : band.min, maxPrice: selected ? undefined : band.max })} />;
        })}
      </View>
      {facets?.brands.length ? (
        <>
          <Text variant="h3">Brand</Text>
          <View style={styles.chips}>
            {facets.brands.map((brand) => (
              <Chip key={brand.slug} label={`${brand.name} (${brand.count})`} selected={brands.has(brand.slug)} onPress={() => toggleBrand(brand.slug)} />
            ))}
          </View>
        </>
      ) : null}
      <Text variant="h3">Customer rating</Text>
      <View style={styles.chips}>
        {[4, 3].map((rating) => (
          <Chip key={rating} label={`${rating}★ & above`} selected={draft.rating === rating} onPress={() => setDraft({ ...draft, rating: draft.rating === rating ? undefined : rating })} />
        ))}
      </View>
      <Text variant="h3">Discount</Text>
      <View style={styles.chips}>
        {[10, 20, 30, 50].map((discount) => (
          <Chip key={discount} label={`${discount}% or more`} selected={draft.discount === discount} onPress={() => setDraft({ ...draft, discount: draft.discount === discount ? undefined : discount })} />
        ))}
      </View>
      <View style={styles.switchRow}>
        <Text variant="h3">In stock only</Text>
        <Switch value={!!draft.inStock} onValueChange={(inStock) => setDraft({ ...draft, inStock: inStock || undefined })} trackColor={{ true: colors.brand500, false: colors.line }} thumbColor={colors.surface} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footer: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
});
