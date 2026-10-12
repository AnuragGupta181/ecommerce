import { router } from "expo-router";
import { Heart } from "lucide-react-native";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { TAB_BAR_CLEARANCE } from "@/components/navigation/pill-tab-bar";
import { ProductCard } from "@/components/product/product-card";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useWishlist } from "@/hooks/use-wishlist";
import { colors, spacing } from "@/lib/theme";

export default function WishlistScreen() {
  const { isLoggedIn, guard } = useRequireAuth();
  const wishlist = useWishlist();

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="h1">Wishlist</Text>
        {wishlist.data?.length ? (
          <Text variant="small" color={colors.ink500}>
            {wishlist.data.length} saved
          </Text>
        ) : null}
      </View>
      {!isLoggedIn ? (
        <EmptyState icon={Heart} title="Save what you love" description="Login to keep a wishlist across devices." actionLabel="Login" onAction={() => guard(() => undefined, "Login to see your wishlist")} />
      ) : wishlist.isPending ? (
        <Loading />
      ) : wishlist.isError ? (
        <ErrorState error={wishlist.error} onRetry={() => wishlist.refetch()} />
      ) : (
        <FlatList
          data={wishlist.data}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_CLEARANCE }]}
          refreshControl={<RefreshControl refreshing={wishlist.isRefetching} onRefresh={() => wishlist.refetch()} tintColor={colors.brand600} />}
          renderItem={({ item }) => <ProductCard product={item} />}
          ListEmptyComponent={<EmptyState icon={Heart} title="Your wishlist is empty" description="Tap the heart on any product to save it here." actionLabel="Start shopping" onAction={() => router.push("/")} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", padding: spacing.lg },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: { gap: spacing.md },
});
