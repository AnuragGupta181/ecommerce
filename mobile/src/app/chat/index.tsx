import { router } from "expo-router";
import { MessageCircle, Store } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useConversations } from "@/hooks/use-support";
import { formatDateTime } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";

export default function ChatsScreen() {
  const conversations = useConversations();

  return (
    <Screen>
      <StackHeader title="Messages" />
      {conversations.isPending ? (
        <Loading />
      ) : conversations.isError ? (
        <ErrorState error={conversations.error} onRetry={() => conversations.refetch()} />
      ) : conversations.data.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No messages" description="Message a shop from its page or from an order." />
      ) : (
        <FlatList
          data={conversations.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={conversations.isRefetching} onRefresh={() => conversations.refetch()} tintColor={colors.brand600} />}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/chat/${item.id}`)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.icon}>
                <Store size={18} color={colors.ink900} />
              </View>
              <View style={styles.flex}>
                <Text variant="h3" numberOfLines={1}>
                  {item.vendor.shopName}
                </Text>
                <Text variant="small" color={colors.ink500} numberOfLines={1}>
                  {item.lastMessage ?? "No messages yet"}
                </Text>
              </View>
              <View style={styles.meta}>
                {item.lastMessageAt ? (
                  <Text variant="small" color={colors.ink500}>
                    {formatDateTime(item.lastMessageAt)}
                  </Text>
                ) : null}
                {item.unread > 0 ? (
                  <View style={styles.badge}>
                    <Text variant="small">{item.unread}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.85 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  meta: { alignItems: "flex-end", gap: 4 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.brand500, alignItems: "center", justifyContent: "center" },
});
