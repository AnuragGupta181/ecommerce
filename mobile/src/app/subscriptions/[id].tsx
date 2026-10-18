import { router, useLocalSearchParams } from "expo-router";
import { FileText, LifeBuoy, MessageCircle } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { DeliveryCalendar } from "@/components/subscriptions/delivery-calendar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { StackHeader } from "@/components/ui/stack-header";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useOpenDocument } from "@/hooks/use-documents";
import { useCancelSubscription, usePauseSubscription, useRenewSubscription, useResumePause, useSkipDelivery, useSubscription } from "@/hooks/use-subscriptions";
import { useOpenChat } from "@/hooks/use-support";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatINR } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";
import { formatDay } from "@/lib/weekdays";

export default function SubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sub = useSubscription(id);
  const skip = useSkipDelivery(id);
  const pause = usePauseSubscription(id);
  const resume = useResumePause(id);
  const cancel = useCancelSubscription(id);
  const renew = useRenewSubscription(id);
  const openDocument = useOpenDocument();
  const openChat = useOpenChat();
  const [sheet, setSheet] = useState<"pause" | "cancel" | null>(null);
  const [pauseFrom, setPauseFrom] = useState<string>();
  const [pauseTo, setPauseTo] = useState<string>();
  const [reason, setReason] = useState("");

  if (sub.isPending) {
    return (
      <Screen backdrop="subscriptions">
        <StackHeader title="Subscription" />
        <Loading layout="detail" />
      </Screen>
    );
  }
  if (sub.isError) {
    return (
      <Screen backdrop="subscriptions">
        <StackHeader title="Subscription" />
        <ErrorState error={sub.error} onRetry={() => sub.refetch()} />
      </Screen>
    );
  }

  const s = sub.data;
  const active = s.status === "ACTIVE";
  const changeable = s.deliveries.filter((drop) => drop.canChange).map((drop) => drop.date.slice(0, 10));
  const fail = (title: string) => (error: unknown) => Alert.alert(title, errorMessage(error));
  const document = (kind: "statement" | "receipt", docId: string) => openDocument.mutate({ kind, id: docId }, { onError: fail("Couldn't open the PDF") });

  return (
    <Screen backdrop="subscriptions">
      <StackHeader title={s.number} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text variant="h2">{s.plan.name}</Text>
          <Text color={colors.ink700}>
            {s.quantity} × {s.product.name} {s.product.variantLabel} · {s.weekdays.join(", ")}
            {s.slot ? ` · ${s.slot}` : ""}
          </Text>
          <Text variant="small" color={colors.ink500}>
            {s.vendor.shopName} · {formatDay(s.startDate)} – {formatDay(s.endDate)} · {s.status === "ACTIVE" ? "Active" : s.status === "CANCELLED" ? "Cancelled" : "Completed"}
          </Text>
          {s.rider ? (
            <Text variant="small" color={colors.ink500}>
              Delivered by {s.rider.name}, {s.rider.phone}
            </Text>
          ) : null}
          {s.cancelReason ? <Text color={colors.danger}>Cancelled: {s.cancelReason}</Text> : null}
        </Card>

        <Card title="Account" right={<Button title="Statement" variant="ghost" small icon={<FileText size={14} color={colors.ink900} />} onPress={() => document("statement", s.id)} />}>
          <View style={styles.ledger}>
            <Figure label="Charged" value={formatINR(s.ledger.charged)} />
            <Figure label="Paid" value={formatINR(s.ledger.paid)} />
            <Figure label="Balance" value={formatINR(s.ledger.balance)} strong />
          </View>
          {s.ledger.dueNow > 0 ? <Text color={colors.warning}>{formatINR(s.ledger.dueNow)} due now. Pay the shop or the rider in cash or UPI.</Text> : null}
          <Text variant="small" color={colors.ink500}>
            Whole period: {formatINR(s.ledger.expectedTotal)} ({formatINR(s.pricePerDelivery)} per drop, delivery {s.deliveryFee ? formatINR(s.deliveryFee) : "free"})
          </Text>
          {s.ledger.instalments.map((instalment) => (
            <Text key={instalment.sequence} variant="small" color={colors.ink700}>
              Instalment {instalment.sequence}: {formatINR(instalment.amount)} due {formatDay(instalment.dueDate)} · {instalment.status.toLowerCase().replace("_", " ")}
            </Text>
          ))}
        </Card>

        <Card title="Deliveries">
          {active ? (
            <Text variant="small" color={colors.ink500}>
              Tap an upcoming day to skip it or bring it back. Changes close at 8 pm the evening before.
            </Text>
          ) : null}
          <DeliveryCalendar
            deliveries={s.deliveries}
            onToggle={(drop) => {
              const skipping = drop.status === "SCHEDULED";
              skip.mutate({ date: drop.date.slice(0, 10), skip: skipping }, { onError: fail(skipping ? "Couldn't skip" : "Couldn't restore") });
            }}
          />
          {s.pauses.map((pauseRow) => (
            <View key={pauseRow.id} style={styles.pause}>
              <Text style={styles.flex}>
                Paused {formatDay(pauseRow.fromDate)} – {formatDay(pauseRow.toDate)}
              </Text>
              {active ? <Button title="Undo" variant="ghost" small loading={resume.isPending} onPress={() => resume.mutate(pauseRow.id, { onError: fail("Couldn't undo the pause") })} /> : null}
            </View>
          ))}
          {active && changeable.length > 1 ? <Button title="Pause for a few days" variant="outline" small onPress={() => setSheet("pause")} style={styles.start} /> : null}
        </Card>

        {s.payments.length ? (
          <Card title="Payments">
            {s.payments.map((payment) => (
              <Pressable key={payment.id} accessibilityRole="button" onPress={() => document("receipt", payment.id)} style={styles.payment}>
                <View style={styles.flex}>
                  <Text variant="h3">{formatINR(payment.amount)}</Text>
                  <Text variant="small" color={colors.ink500}>
                    {payment.receiptNumber} · {payment.method} · {formatDateTime(payment.paidAt)}
                  </Text>
                </View>
                <FileText size={18} color={colors.ink700} />
              </Pressable>
            ))}
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button
            title="Message shop"
            variant="outline"
            icon={<MessageCircle size={16} color={colors.ink900} />}
            loading={openChat.isPending}
            onPress={() => openChat.mutate(s.vendor.id, { onSuccess: (conversation) => router.push(`/chat/${conversation.id}`), onError: fail("Couldn't open chat") })}
          />
          <Button title="Report a problem" variant="outline" icon={<LifeBuoy size={16} color={colors.ink900} />} onPress={() => router.push({ pathname: "/tickets/new", params: { subscriptionId: s.id, category: "SUBSCRIPTION_ISSUE" } })} />
          {s.actions.canRenew ? (
            <Button title="Renew for another period" loading={renew.isPending} onPress={() => renew.mutate(undefined, { onSuccess: (created) => router.replace(`/subscriptions/${created.id}`), onError: fail("Couldn't renew") })} />
          ) : null}
          {s.actions.canCancel ? <Button title="Cancel subscription" variant="danger" onPress={() => setSheet("cancel")} /> : null}
        </View>
      </ScrollView>

      <Sheet
        visible={sheet === "pause"}
        title="Pause deliveries"
        onClose={() => setSheet(null)}
        footer={
          <Button
            title="Pause"
            disabled={!pauseFrom || !pauseTo || pauseTo < pauseFrom}
            loading={pause.isPending}
            onPress={() =>
              pauseFrom &&
              pauseTo &&
              pause.mutate({ fromDate: pauseFrom, toDate: pauseTo }, { onSuccess: () => setSheet(null), onError: fail("Couldn't pause") })
            }
          />
        }
      >
        <Text variant="small" color={colors.ink500}>
          From
        </Text>
        <View style={styles.chips}>
          {changeable.map((date) => (
            <Chip key={date} label={formatDay(date)} selected={pauseFrom === date} onPress={() => setPauseFrom(date)} />
          ))}
        </View>
        <Text variant="small" color={colors.ink500}>
          Until (inclusive)
        </Text>
        <View style={styles.chips}>
          {changeable
            .filter((date) => !pauseFrom || date >= pauseFrom)
            .map((date) => (
              <Chip key={date} label={formatDay(date)} selected={pauseTo === date} onPress={() => setPauseTo(date)} />
            ))}
        </View>
      </Sheet>

      <Sheet
        visible={sheet === "cancel"}
        title="Cancel subscription?"
        onClose={() => setSheet(null)}
        footer={
          <Button
            title="Cancel subscription"
            variant="secondary"
            disabled={reason.trim().length < 3}
            loading={cancel.isPending}
            onPress={() => cancel.mutate(reason.trim(), { onSuccess: () => setSheet(null), onError: fail("Couldn't cancel") })}
          />
        }
      >
        <Text color={colors.ink700}>Future deliveries are cancelled. You still pay for drops already delivered.</Text>
        <Input label="Reason" value={reason} onChangeText={setReason} placeholder="Moving out, travelling…" />
      </Sheet>
    </Screen>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.figure}>
      <Text variant="small" color={colors.ink500}>
        {label}
      </Text>
      <Text variant={strong ? "price" : "h3"}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  ledger: { flexDirection: "row", gap: spacing.md },
  figure: { flex: 1, gap: 2 },
  pause: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  start: { alignSelf: "flex-start" },
  payment: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  actions: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
