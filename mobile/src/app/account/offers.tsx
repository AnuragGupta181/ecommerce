import { Tag } from "lucide-react-native";
import { FlatList, StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { usePublicCoupons } from "@/hooks/use-account";
import { formatDate } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";

export default function OffersScreen() {
  const coupons = usePublicCoupons();

  return (
    <Screen>
      <StackHeader title="Offers & coupons" />
      {coupons.isPending ? (
        <Loading />
      ) : coupons.isError ? (
        <ErrorState error={coupons.error} onRetry={() => coupons.refetch()} />
      ) : (
        <FlatList
          data={coupons.data}
          keyExtractor={(item) => item.code}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon={Tag} title="No offers right now" description="Check back soon for new deals." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.code}>
                <Text variant="h3">{item.code}</Text>
              </View>
              <Text variant="h3">{item.title}</Text>
              <Text color={colors.ink700}>{item.description}</Text>
              <Text variant="small" color={colors.ink500}>
                {[item.firstOrderOnly ? "First order only" : null, item.endsAt ? `Valid till ${formatDate(item.endsAt)}` : null].filter(Boolean).join(" · ") || "Apply at checkout"}
              </Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderStyle: "dashed", borderColor: colors.brand600, padding: spacing.lg, gap: spacing.xs },
  code: { alignSelf: "flex-start", backgroundColor: colors.brand100, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2, marginBottom: spacing.xs },
});
