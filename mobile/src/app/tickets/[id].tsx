import { useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useCloseTicket, useReplyTicket, useTicket } from "@/hooks/use-support";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";
import { TICKET_STATUS } from "@/lib/ticket-status";

const AUTHOR = { CUSTOMER: "You", VENDOR: "Shop", ADMIN: "Haat support", SYSTEM: "Update" } as const;

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = useTicket(id);
  const reply = useReplyTicket(id);
  const close = useCloseTicket(id);
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState("");

  if (ticket.isPending) {
    return (
      <Screen>
        <StackHeader title="Ticket" />
        <Loading layout="detail" />
      </Screen>
    );
  }
  if (ticket.isError) {
    return (
      <Screen>
        <StackHeader title="Ticket" />
        <ErrorState error={ticket.error} onRetry={() => ticket.refetch()} />
      </Screen>
    );
  }

  const t = ticket.data;
  const closed = t.status === "CLOSED";
  const send = () =>
    reply.mutate(body.trim(), {
      onSuccess: () => setBody(""),
      onError: (error) => Alert.alert("Couldn't send", errorMessage(error)),
    });

  return (
    <Screen>
      <StackHeader title={t.number} right={!closed ? <Button title="Close" variant="ghost" small loading={close.isPending} onPress={() => close.mutate()} /> : null} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="h2">{t.subject}</Text>
          <Text variant="small" color={TICKET_STATUS[t.status].color}>
            {TICKET_STATUS[t.status].label} · {t.handledBy === "SHOP" && t.vendor ? `handled by ${t.vendor.shopName}` : "handled by Haat support"}
          </Text>
          {t.messages.map((message) => (
            <View key={message.id} style={[styles.bubble, message.mine ? styles.mine : message.authorRole === "SYSTEM" ? styles.system : styles.theirs]}>
              <Text variant="small" color={colors.ink500}>
                {AUTHOR[message.authorRole]}
              </Text>
              <Text>{message.body}</Text>
              <Text variant="small" color={colors.ink500}>
                {formatDateTime(message.createdAt)}
              </Text>
            </View>
          ))}
        </ScrollView>
        {closed ? (
          <Text color={colors.ink500} style={[styles.closed, { paddingBottom: insets.bottom + spacing.md }]}>
            This ticket is closed. Raise a new one if you still need help.
          </Text>
        ) : (
          <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
            <TextInput style={styles.input} value={body} onChangeText={setBody} placeholder="Write a reply" placeholderTextColor={colors.ink300} multiline />
            <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!body.trim() || reply.isPending} onPress={send} style={[styles.send, (!body.trim() || reply.isPending) && styles.disabled]}>
              <Send size={18} color={colors.ink900} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  bubble: { maxWidth: "85%", padding: spacing.md, borderRadius: radius.card, gap: 4 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.brand100 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  system: { alignSelf: "center", backgroundColor: colors.canvas },
  closed: { textAlign: "center", padding: spacing.lg },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.medium, fontSize: 15, color: colors.ink900 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand500, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
});
