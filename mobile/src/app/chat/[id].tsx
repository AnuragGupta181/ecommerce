import { router, useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useChatThread, useConversations } from "@/hooks/use-support";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";

export default function ChatScreen() {
  const { id, orderId } = useLocalSearchParams<{ id: string; orderId?: string }>();
  const thread = useChatThread(id);
  const conversations = useConversations();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState("");
  const list = useRef<FlatList>(null);
  const shopName = conversations.data?.find((conversation) => conversation.id === id)?.vendor.shopName ?? "Shop";

  useEffect(() => {
    if (thread.messages.length) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  }, [thread.messages.length]);

  const send = () =>
    thread.send.mutate(
      { body: body.trim(), orderId: orderId || undefined },
      { onSuccess: () => setBody(""), onError: (error) => Alert.alert("Couldn't send", errorMessage(error)) },
    );

  return (
    <Screen>
      <StackHeader title={shopName} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {thread.isPending ? (
          <Loading layout="chat" />
        ) : thread.error && !thread.messages.length ? (
          <ErrorState error={thread.error} />
        ) : (
          <FlatList
            ref={list}
            data={thread.messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.content}
            ListEmptyComponent={<Text color={colors.ink500}>Say hello. The shop usually replies within a few minutes during opening hours.</Text>}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.senderRole === "SYSTEM" ? styles.system : item.mine ? styles.mine : styles.theirs]}>
                <Text>{item.body}</Text>
                {item.order ? (
                  <Pressable onPress={() => router.push(`/orders/${item.order?.id}`)}>
                    <Text variant="small" color={colors.brand700}>
                      Order #{item.order.orderNumber}
                    </Text>
                  </Pressable>
                ) : null}
                <Text variant="small" color={colors.ink500}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>
            )}
          />
        )}
        <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput style={styles.input} value={body} onChangeText={setBody} placeholder="Message the shop" placeholderTextColor={colors.ink300} multiline />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!body.trim() || thread.send.isPending}
            onPress={send}
            style={[styles.send, (!body.trim() || thread.send.isPending) && styles.disabled]}
          >
            <Send size={18} color={colors.ink900} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm },
  bubble: { maxWidth: "85%", padding: spacing.md, borderRadius: radius.card, gap: 4 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.brand100 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  system: { alignSelf: "center", backgroundColor: colors.canvas },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.medium, fontSize: 15, color: colors.ink900 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand500, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
});
