import { router } from "expo-router";
import { LifeBuoy } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useTickets } from "@/hooks/use-support";
import { formatDateTime } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import { TICKET_STATUS } from "@/lib/ticket-status";

export default function TicketsScreen() {
  const tickets = useTickets();

  return (
    <Screen backdrop="support">
      <StackHeader title="Help & support" right={<Button title="New" small onPress={() => router.push("/tickets/new")} />} />
      {tickets.isPending ? (
        <Loading />
      ) : tickets.isError ? (
        <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} />
      ) : tickets.data.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets" description="Problem with an order, a subscription or the app? Tell us and we'll sort it out." actionLabel="Raise a ticket" onAction={() => router.push("/tickets/new")} />
      ) : (
        <FlatList
          data={tickets.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={tickets.isRefetching} onRefresh={() => tickets.refetch()} tintColor={colors.brand600} />}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/tickets/${item.id}`)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.row}>
                <Text variant="h3" numberOfLines={1} style={styles.flex}>
                  {item.subject}
                </Text>
                <Text variant="small" color={TICKET_STATUS[item.status].color}>
                  {TICKET_STATUS[item.status].label}
                </Text>
              </View>
              <Text variant="small" color={colors.ink500}>
                {item.number} · {item.level === "MINOR" && item.vendor ? item.vendor.shopName : "Haat support"}
                {item.order ? ` · ${item.order.orderNumber}` : ""} · {formatDateTime(item.lastMessageAt)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  card: { padding: spacing.md, gap: 4, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.85 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});
