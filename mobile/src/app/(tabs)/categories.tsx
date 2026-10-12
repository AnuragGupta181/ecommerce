import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CategoryBubble } from "@/components/home/category-strip";
import { TAB_BAR_CLEARANCE } from "@/components/navigation/pill-tab-bar";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { SearchBar } from "@/components/ui/search-bar";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useCategories } from "@/hooks/use-catalog";
import { openListing } from "@/lib/navigation";
import { colors, spacing } from "@/lib/theme";

export default function CategoriesScreen() {
  const categories = useCategories();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const roots = categories.data ?? [];
  const selected = roots.find((category) => category.id === selectedId) ?? roots[0];

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="h1">Categories</Text>
        <SearchBar />
      </View>
      {categories.isPending ? (
        <Loading />
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      ) : (
        <View style={styles.panes}>
          <ScrollView style={styles.rail} contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}>
            {roots.map((category) => {
              const active = category.id === selected?.id;
              return (
                <Pressable key={category.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setSelectedId(category.id)} style={[styles.railItem, active && styles.railActive]}>
                  <Text variant="small" color={active ? colors.ink900 : colors.ink700} style={active ? styles.bold : undefined}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {selected ? (
            <ScrollView contentContainerStyle={[styles.detail, { paddingBottom: TAB_BAR_CLEARANCE }]}>
              <Text variant="h2">{selected.name}</Text>
              <Button title={`Shop all ${selected.name}`} variant="outline" small onPress={() => openListing({ category: selected.slug }, selected.name)} />
              <View style={styles.grid}>
                {(selected.children ?? []).map((child) => (
                  <CategoryBubble key={child.id} category={child} size={60} />
                ))}
              </View>
            </ScrollView>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.md },
  panes: { flex: 1, flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line },
  rail: { width: 104, flexGrow: 0, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.line },
  railItem: { paddingVertical: spacing.lg, paddingHorizontal: spacing.md, borderLeftWidth: 3, borderLeftColor: "transparent" },
  railActive: { backgroundColor: colors.brand50, borderLeftColor: colors.brand500 },
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
  detail: { padding: spacing.lg, gap: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
});
