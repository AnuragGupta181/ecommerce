import { Image } from "expo-image";
import { router } from "expo-router";
import { Repeat } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { colors, radius, spacing } from "@/lib/theme";
import { formatDay } from "@/lib/weekdays";

export default function SubscriptionsScreen() {
  const subscriptions = useSubscriptions();

  return (
    <Screen>
      <StackHeader title="My subscriptions" />
      {subscriptions.isPending ? (
        <Loading />
      ) : subscriptions.isError ? (
        <ErrorState error={subscriptions.error} onRetry={() => subscriptions.refetch()} />
      ) : subscriptions.data.length === 0 ? (
        <EmptyState icon={Repeat} title="No subscriptions yet" description="Get milk, curd and bread delivered every morning from a shop near you." actionLabel="Browse daily essentials" onAction={() => router.push("/")} />
      ) : (
        <FlatList
          data={subscriptions.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={subscriptions.isRefetching} onRefresh={() => subscriptions.refetch()} tintColor={colors.brand600} />}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/subscriptions/${item.id}`)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <Image source={item.product.imageUrl} style={styles.image} contentFit="contain" />
              <View style={styles.flex}>
                <Text variant="h3">{item.plan.name}</Text>
                <Text variant="small" color={colors.ink500}>
                  {item.quantity} × {item.product.name} · {item.vendor.shopName}
                </Text>
                <Text variant="small" color={colors.ink700}>
                  {item.status === "ACTIVE" ? (item.nextDelivery ? `Next: ${formatDay(item.nextDelivery)}${item.slot ? `, ${item.slot}` : ""}` : "No more deliveries") : item.status === "CANCELLED" ? "Cancelled" : "Completed"}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  card: { flexDirection: "row", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.85 },
  image: { width: 56, height: 56, borderRadius: radius.control, backgroundColor: colors.canvas },
  flex: { flex: 1, gap: 2 },
});
