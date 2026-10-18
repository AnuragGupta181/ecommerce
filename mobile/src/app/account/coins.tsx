import { Coins } from "lucide-react-native";
import { FlatList, StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useCoins } from "@/hooks/use-account";
import { formatDate } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";

export default function CoinsScreen() {
  const coins = useCoins();

  return (
    <Screen backdrop="offers">
      <StackHeader title="Haat coins" />
      {coins.isPending ? (
        <Loading />
      ) : coins.isError ? (
        <ErrorState error={coins.error} onRetry={() => coins.refetch()} />
      ) : (
        <FlatList
          data={coins.data.history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.hero}>
              <Text variant="small" color={colors.ink700}>
                Available balance
              </Text>
              <Text variant="display">{coins.data.balance}</Text>
              <Text variant="small" color={colors.ink700}>
                1 coin = ₹1 off · {coins.data.pending} pending from orders on the way · {coins.data.lifetimeEarned} earned so far
              </Text>
            </View>
          }
          ListEmptyComponent={<EmptyState icon={Coins} title="No coin activity yet" description="Coins are credited when an order is delivered." />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text variant="h3">{item.note ?? item.type.replace(/_/g, " ").toLowerCase()}</Text>
                <Text variant="small" color={colors.ink500}>
                  {formatDate(item.createdAt)}
                  {item.orderNumber ? ` · Order ${item.orderNumber}` : ""}
                </Text>
              </View>
              <Text variant="h3" color={item.amount >= 0 ? colors.success : colors.danger}>
                {item.amount >= 0 ? `+${item.amount}` : item.amount}
              </Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  hero: { backgroundColor: colors.brand100, borderRadius: radius.card, padding: spacing.xl, gap: spacing.xs, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  flex: { flex: 1, gap: 2 },
});
