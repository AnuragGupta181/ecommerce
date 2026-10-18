import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionRow } from "@/components/ui/option-row";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Text } from "@/components/ui/text";
import { useOrders } from "@/hooks/use-orders";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { useCreateTicket } from "@/hooks/use-support";
import { errorMessage, fieldErrors } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import type { TicketCategory } from "@/lib/types";

/** Shop problems go to the shop that can fix them; app, payment and account problems go to Haat. */
const CATEGORIES: { value: TicketCategory; label: string; description: string }[] = [
  { value: "ORDER_ISSUE", label: "An order", description: "Missing, damaged or wrong items. The shop will help." },
  { value: "SUBSCRIPTION_ISSUE", label: "A subscription", description: "Late or missed deliveries. The shop will help." },
  { value: "PAYMENT", label: "Payment or refund", description: "Haat support" },
  { value: "VENDOR_COMPLAINT", label: "Complaint about a shop", description: "Haat support" },
  { value: "APP_BUG", label: "The app isn't working", description: "Haat support" },
  { value: "ACCOUNT", label: "My account", description: "Haat support" },
  { value: "OTHER", label: "Something else", description: "Haat support" },
];

export default function NewTicketScreen() {
  const params = useLocalSearchParams<{ orderId?: string; subscriptionId?: string; category?: TicketCategory }>();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<TicketCategory>(params.category ?? (params.orderId ? "ORDER_ISSUE" : "OTHER"));
  const [orderId, setOrderId] = useState(params.orderId);
  const [subscriptionId, setSubscriptionId] = useState(params.subscriptionId);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const create = useCreateTicket();
  const orders = useOrders(undefined);
  const subscriptions = useSubscriptions();
  const errors = fieldErrors(create.error);
  const recentOrders = orders.data?.pages.flatMap((page) => page.data).slice(0, 8) ?? [];

  const submit = () =>
    create.mutate(
      {
        category,
        subject: subject.trim(),
        message: message.trim(),
        orderId: category === "ORDER_ISSUE" ? orderId : undefined,
        subscriptionId: category === "SUBSCRIPTION_ISSUE" ? subscriptionId : undefined,
      },
      {
        onSuccess: (ticket) => router.replace(`/tickets/${ticket.id}`),
        onError: (error) => {
          if (!Object.keys(fieldErrors(error)).length) Alert.alert("Couldn't send", errorMessage(error));
        },
      },
    );

  return (
    <Screen backdrop="support">
      <StackHeader title="Raise a ticket" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card title="What is it about?">
          {CATEGORIES.map((option) => (
            <OptionRow key={option.value} label={option.label} description={option.description} selected={category === option.value} onPress={() => setCategory(option.value)} />
          ))}
        </Card>

        {category === "ORDER_ISSUE" ? (
          <Card title="Which order?">
            {errors.orderId ? <Text color={colors.danger}>{errors.orderId}</Text> : null}
            {recentOrders.length === 0 ? <Text color={colors.ink500}>No orders yet.</Text> : null}
            {recentOrders.map((order) => (
              <OptionRow key={order.id} label={`#${order.orderNumber}`} description={order.items.map((item) => item.productName).join(", ")} selected={orderId === order.id} onPress={() => setOrderId(order.id)} />
            ))}
          </Card>
        ) : null}

        {category === "SUBSCRIPTION_ISSUE" ? (
          <Card title="Which subscription?">
            {errors.subscriptionId ? <Text color={colors.danger}>{errors.subscriptionId}</Text> : null}
            {subscriptions.data?.length === 0 ? <Text color={colors.ink500}>No subscriptions yet.</Text> : null}
            {subscriptions.data?.map((sub) => (
              <OptionRow key={sub.id} label={sub.plan.name} description={`${sub.number} · ${sub.vendor.shopName}`} selected={subscriptionId === sub.id} onPress={() => setSubscriptionId(sub.id)} />
            ))}
          </Card>
        ) : null}

        <Card title="Tell us more">
          <Input label="Subject" value={subject} onChangeText={setSubject} error={errors.subject} placeholder="One curd packet was leaking" />
          <Input label="Details" value={message} onChangeText={setMessage} error={errors.message} multiline style={styles.message} placeholder="What happened, and what would fix it?" />
        </Card>
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title="Send" loading={create.isPending} disabled={subject.trim().length < 4 || message.trim().length < 5} onPress={submit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  message: { minHeight: 120, textAlignVertical: "top", paddingTop: 12 },
  bar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
});
