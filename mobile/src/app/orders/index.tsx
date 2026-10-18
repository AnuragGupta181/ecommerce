import { Image } from "expo-image";
import { router } from "expo-router";
import { Package } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBadge } from "@/components/orders/status-badge";
import { Chip } from "@/components/ui/chip";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useOrders, type OrderFilter } from "@/hooks/use-orders";
import { formatDate, formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "active", label: "Active" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returns", label: "Returns" },
];

export default function OrdersScreen() {
  const [filter, setFilter] = useState<OrderFilter>();
  const orders = useOrders(filter);
  const items = orders.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Screen backdrop="orders">
      <StackHeader title="My orders" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip key={f.label} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
      </View>
      {orders.isPending ? (
        <Loading />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={orders.isRefetching && !orders.isFetchingNextPage} onRefresh={() => orders.refetch()} tintColor={colors.brand600} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => orders.hasNextPage && !orders.isFetchingNextPage && orders.fetchNextPage()}
          ListFooterComponent={orders.isFetchingNextPage ? <ActivityIndicator color={colors.brand600} /> : null}
          ListEmptyComponent={<EmptyState icon={Package} title="No orders here" description="Orders you place will show up here." actionLabel="Start shopping" onAction={() => router.dismissTo("/")} />}
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/orders/${item.id}`)}>
              <View style={styles.head}>
                <StatusBadge status={item.status} />
                <Text variant="small" color={colors.ink500}>
                  {formatDate(item.deliveredAt ?? item.createdAt)}
                </Text>
              </View>
              <View style={styles.body}>
                <View style={styles.thumbs}>
                  {item.items.slice(0, 3).map((line, i) => (
                    <Image key={i} source={line.imageUrl} style={styles.thumb} contentFit="contain" />
                  ))}
                </View>
                <View style={styles.flex}>
                  <Text numberOfLines={1}>{item.items[0]?.productName}</Text>
                  <Text variant="small" color={colors.ink500}>
                    {item.itemCount > 1 ? `+${item.itemCount - 1} more · ` : ""}#{item.orderNumber}
                  </Text>
                </View>
                <Text variant="h3">{formatINR(item.payable)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md },
  pressed: { opacity: 0.85 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  body: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumbs: { flexDirection: "row", gap: 4 },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.canvas },
  flex: { flex: 1, gap: 2 },
});
