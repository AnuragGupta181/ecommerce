import { router, useLocalSearchParams } from "expo-router";
import { ArrowUpDown, PackageSearch, Search, SlidersHorizontal } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { FilterSheet, SORTS, SortSheet } from "@/components/product/listing-sheets";
import { ProductCard } from "@/components/product/product-card";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useFacets, useProducts, type ListingQuery } from "@/hooks/use-catalog";
import { parseListing } from "@/lib/navigation";
import { colors, spacing } from "@/lib/theme";

export default function ProductListingScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const initial = useMemo(() => parseListing(params), [params]);
  const [query, setQuery] = useState<ListingQuery>(initial);
  const [sheet, setSheet] = useState<"sort" | "filter" | null>(null);
  const products = useProducts(query);
  const facets = useFacets(query);

  const items = products.data?.pages.flatMap((page) => page.data) ?? [];
  const total = products.data?.pages[0]?.meta?.total;
  const activeFilters = [query.brand, query.minPrice ?? query.maxPrice, query.rating, query.discount, query.inStock].filter(Boolean).length;
  const sortLabel = SORTS.find((sort) => sort.value === (query.sort ?? "relevance"))?.label;

  return (
    <Screen backdrop="shop">
      <StackHeader
        title={params.title || (query.q ? `"${query.q}"` : "Products")}
        right={
          <Pressable accessibilityLabel="Search" hitSlop={8} onPress={() => router.push("/search")}>
            <Search size={22} color={colors.ink900} />
          </Pressable>
        }
      />
      <View style={styles.toolbar}>
        <Pressable style={styles.tool} onPress={() => setSheet("sort")}>
          <ArrowUpDown size={16} color={colors.ink900} />
          <Text variant="small" numberOfLines={1}>
            {sortLabel}
          </Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.tool} onPress={() => setSheet("filter")}>
          <SlidersHorizontal size={16} color={colors.ink900} />
          <Text variant="small">Filters{activeFilters ? ` (${activeFilters})` : ""}</Text>
        </Pressable>
      </View>
      {products.isPending ? (
        <Loading layout="grid" />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProductCard product={item} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
          ListHeaderComponent={
            total !== undefined ? (
              <Text variant="small" color={colors.ink500}>
                {total} products
              </Text>
            ) : null
          }
          ListFooterComponent={products.isFetchingNextPage ? <ActivityIndicator color={colors.brand600} /> : null}
          ListEmptyComponent={<EmptyState icon={PackageSearch} title="No products found" description="Try removing some filters or searching for something else." />}
        />
      )}
      <SortSheet visible={sheet === "sort"} value={query.sort} onClose={() => setSheet(null)} onChange={(sort) => setQuery({ ...query, sort })} />
      {sheet === "filter" ? <FilterSheet visible value={query} facets={facets.data} onClose={() => setSheet(null)} onApply={(filters) => setQuery({ ...query, brand: undefined, minPrice: undefined, maxPrice: undefined, rating: undefined, discount: undefined, inStock: undefined, ...filters })} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  tool: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44 },
  divider: { width: 1, height: 24, backgroundColor: colors.line },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: { gap: spacing.md },
});
