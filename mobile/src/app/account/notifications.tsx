import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useMarkAllRead, useNotifications } from "@/hooks/use-account";
import { formatDateTime } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";

export default function NotificationsScreen() {
  const notifications = useNotifications();
  const markAll = useMarkAllRead();
  const hasUnread = notifications.data?.some((item) => !item.readAt);

  return (
    <Screen>
      <StackHeader
        title="Notifications"
        right={
          hasUnread ? (
            <Pressable hitSlop={8} onPress={() => markAll.mutate()}>
              <Text variant="small" color={colors.brand700} style={styles.bold}>
                Mark all read
              </Text>
            </Pressable>
          ) : null
        }
      />
      {notifications.isPending ? (
        <Loading />
      ) : notifications.isError ? (
        <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />
      ) : (
        <FlatList
          data={notifications.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={() => notifications.refetch()} tintColor={colors.brand600} />}
          ListEmptyComponent={<EmptyState icon={Bell} title="You're all caught up" description="Order updates and offers will appear here." />}
          renderItem={({ item }) => {
            const orderId = item.data?.orderId;
            return (
              <Pressable disabled={!orderId} onPress={() => orderId && router.push(`/orders/${orderId}`)} style={[styles.card, !item.readAt && styles.unread]}>
                <View style={styles.flex}>
                  <Text variant="h3">{item.title}</Text>
                  <Text color={colors.ink700}>{item.body}</Text>
                  <Text variant="small" color={colors.ink500}>
                    {formatDateTime(item.createdAt)}
                  </Text>
                </View>
                {!item.readAt ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  card: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  unread: { backgroundColor: colors.brand50, borderColor: colors.brand200 },
  flex: { flex: 1, gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand600, marginTop: 6 },
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
});
