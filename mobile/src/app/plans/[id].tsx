import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OfferBadge, shopLabel, shopMeta } from "@/components/shop/shop-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { OptionRow } from "@/components/ui/option-row";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useAddresses } from "@/hooks/use-account";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { usePlan, useSubscribe, useSubscriptionQuote } from "@/hooks/use-subscriptions";
import { errorMessage } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import type { PaymentPlan, Period, SubscriptionInput } from "@/lib/types";
import { addDays, EVERY_DAY, formatDay, hasWeekday, todayIso, toggleWeekday, upcomingDates, WEEKDAYS } from "@/lib/weekdays";

const PAYMENT_PLANS: { value: PaymentPlan; label: string; description: string }[] = [
  { value: "END_OF_PERIOD", label: "Pay at the end", description: "Pay the shop for what was delivered when the period ends" },
  { value: "UPFRONT", label: "Pay upfront", description: "Pay for the whole period at the start" },
  { value: "TWO_INSTALMENTS", label: "Two instalments", description: "Half at the start, the rest midway" },
];

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = usePlan(id);
  const addresses = useAddresses();
  const subscribe = useSubscribe();
  const { isLoggedIn, guard } = useRequireAuth();
  const insets = useSafeAreaInsets();

  const firstDay = addDays(todayIso(), 1);
  const [period, setPeriod] = useState<Period>();
  const [startDate, setStartDate] = useState(firstDay);
  const [weekdays, setWeekdays] = useState(EVERY_DAY);
  const [quantity, setQuantity] = useState(1);
  const [slot, setSlot] = useState<string>();
  // Skipped dates belong to one schedule; changing period, start or days starts a fresh list.
  const [skipped, setSkipped] = useState<{ schedule: string; dates: string[] }>({ schedule: "", dates: [] });
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("END_OF_PERIOD");
  const [addressId, setAddressId] = useState<string>();

  const p = plan.data;
  const chosenPeriod = period ?? p?.prices[0]?.period;
  const address = addresses.data?.find((a) => a.id === addressId) ?? addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];

  const schedule = `${chosenPeriod}|${startDate}|${weekdays}`;
  const skipDates = useMemo(() => (skipped.schedule === schedule ? skipped.dates : []), [skipped, schedule]);
  const toggleSkip = (date: string) => setSkipped({ schedule, dates: skipDates.includes(date) ? skipDates.filter((d) => d !== date) : [...skipDates, date] });

  const input: SubscriptionInput | null = useMemo(
    () =>
      p && chosenPeriod
        ? { planId: p.id, period: chosenPeriod, startDate, weekdays, quantity, slot: slot ?? p.slots[0], skipDates, paymentPlan, addressId: address?.id }
        : null,
    [p, chosenPeriod, startDate, weekdays, quantity, slot, skipDates, paymentPlan, address?.id],
  );
  const quote = useSubscriptionQuote(isLoggedIn ? input : null);

  if (plan.isPending) {
    return (
      <Screen backdrop="subscriptions">
        <StackHeader title="" />
        <Loading layout="detail" />
      </Screen>
    );
  }
  if (plan.isError || !p) {
    return (
      <Screen backdrop="subscriptions">
        <StackHeader title="" />
        <ErrorState error={plan.error} onRetry={() => plan.refetch()} />
      </Screen>
    );
  }

  const canSubscribe = p.isActive && !p.isFull && p.shop.deliverable && weekdays > 0;
  const submit = () =>
    guard(() => {
      if (!input || !address) {
        Alert.alert("Add an address", "We need to know where to deliver.", [{ text: "Add address", onPress: () => router.push("/account/address-form") }, { text: "Cancel", style: "cancel" }]);
        return;
      }
      subscribe.mutate(
        { ...input, addressId: address.id },
        { onSuccess: (created) => router.replace(`/subscriptions/${created.id}`), onError: (error) => Alert.alert("Couldn't subscribe", errorMessage(error)) },
      );
    }, "Login to subscribe");

  return (
    <Screen backdrop="subscriptions">
      <StackHeader title={p.name} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Image source={p.product.imageUrl} style={styles.image} contentFit="contain" />
          <View style={styles.flex}>
            <Text variant="h2">{p.name}</Text>
            <Text color={colors.ink700}>
              {p.quantityPerDelivery} × {p.product.name} {p.product.variantLabel} per delivery
            </Text>
            <Text variant="small" color={colors.ink500}>
              {p.shop.vendorName} · {shopMeta(p.shop, formatINR)}
            </Text>
            <OfferBadge label={shopLabel(p.shop)} />
          </View>
        </View>
        {p.description ? <Text color={colors.ink700}>{p.description}</Text> : null}

        <Card title="Plan">
          <View style={styles.chips}>
            {p.prices.map((price) => (
              <Chip
                key={price.period}
                label={`${price.period === "WEEKLY" ? "Weekly" : "Monthly"} · ${formatINR(price.pricePerDelivery)}/day${price.deliveryFee ? "" : " · free delivery"}`}
                selected={price.period === chosenPeriod}
                onPress={() => setPeriod(price.period)}
              />
            ))}
          </View>
          <Text variant="small" color={colors.ink500}>
            Usually {formatINR(p.product.regularPrice)} each in the shop.
          </Text>
        </Card>

        <Card title="Delivery days">
          <View style={styles.chips}>
            <Chip label="Every day" selected={weekdays === EVERY_DAY} onPress={() => setWeekdays(EVERY_DAY)} />
            <Chip label="Weekdays" selected={weekdays === 31} onPress={() => setWeekdays(31)} />
          </View>
          <View style={styles.chips}>
            {WEEKDAYS.map((day) => (
              <Chip key={day.name} label={day.name} selected={hasWeekday(weekdays, day.bit)} onPress={() => setWeekdays((mask) => toggleWeekday(mask, day.bit))} />
            ))}
          </View>
          {weekdays === 0 ? (
            <Text variant="small" color={colors.danger}>
              Pick at least one day
            </Text>
          ) : null}
        </Card>

        <Card title="Starts on">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRail}>
            {upcomingDates(firstDay, 14).map((date) => (
              <Chip key={date} label={formatDay(date)} selected={date === startDate} onPress={() => setStartDate(date)} />
            ))}
          </ScrollView>
        </Card>

        {p.slots.length ? (
          <Card title="Time slot">
            <View style={styles.chips}>
              {p.slots.map((value) => (
                <Chip key={value} label={value} selected={(slot ?? p.slots[0]) === value} onPress={() => setSlot(value)} />
              ))}
            </View>
          </Card>
        ) : null}

        <Card title="Quantity" right={<QuantityStepper value={quantity} max={20} onChange={setQuantity} />}>
          <Text variant="small" color={colors.ink500}>
            {quantity * p.quantityPerDelivery} × {p.product.variantLabel} each delivery
          </Text>
        </Card>

        {quote.data ? (
          <Card title="Skip dates (optional)">
            <Text variant="small" color={colors.ink500}>
              Tap a date you don&apos;t need a delivery. You can also skip or pause later.
            </Text>
            <View style={styles.chips}>
              {[...quote.data.schedule.dates, ...quote.data.schedule.skipped].sort().map((date) => (
                <Chip
                  key={date}
                  label={skipDates.includes(date) ? `${formatDay(date)} · skip` : formatDay(date)}
                  selected={skipDates.includes(date)}
                  onPress={() => toggleSkip(date)}
                />
              ))}
            </View>
          </Card>
        ) : null}

        <Card title="Payment">
          {PAYMENT_PLANS.map((option) => (
            <OptionRow key={option.value} label={option.label} description={option.description} selected={paymentPlan === option.value} onPress={() => setPaymentPlan(option.value)} />
          ))}
          <Text variant="small" color={colors.ink500}>
            Pay the shop in cash or UPI; you get a receipt for every payment.
          </Text>
        </Card>

        {isLoggedIn ? (
          <Card title="Deliver to" right={<Button title="Add new" variant="ghost" small onPress={() => router.push("/account/address-form")} />}>
            {addresses.data?.length ? (
              addresses.data.map((a) => <OptionRow key={a.id} label={a.name} description={`${a.line1}, ${a.city} ${a.pincode}`} selected={a.id === address?.id} onPress={() => setAddressId(a.id)} />)
            ) : (
              <Text color={colors.ink500}>Add an address to subscribe.</Text>
            )}
          </Card>
        ) : null}

        <Card title="Price breakdown">
          {!isLoggedIn ? (
            <Text color={colors.ink500}>Login to see the exact price for your dates.</Text>
          ) : quote.isPending && !quote.data ? (
            <ActivityIndicator color={colors.brand600} />
          ) : quote.isError ? (
            <Text color={colors.danger}>{errorMessage(quote.error)}</Text>
          ) : quote.data ? (
            <View style={styles.breakdown}>
              <Row label={`${quote.data.breakdown.deliveries} deliveries, ${formatDay(quote.data.schedule.startDate)} – ${formatDay(quote.data.schedule.endDate)}`} value="" />
              <Row label={`Goods (${formatINR(quote.data.breakdown.perDelivery.goods)} each)`} value={formatINR(quote.data.breakdown.goodsTotal)} />
              <Row label="Delivery" value={quote.data.breakdown.deliveryTotal ? formatINR(quote.data.breakdown.deliveryTotal) : "Free"} />
              <View style={styles.total}>
                <Row label="Total for the period" value={formatINR(quote.data.breakdown.total)} bold />
              </View>
              {quote.data.instalments.length > 1 || paymentPlan !== "END_OF_PERIOD"
                ? quote.data.instalments.map((instalment) => (
                    <Row key={instalment.sequence} label={`Instalment ${instalment.sequence}, due ${formatDay(instalment.dueDate)}`} value={formatINR(instalment.amount)} muted />
                  ))
                : null}
            </View>
          ) : null}
        </Card>
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={!p.shop.deliverable ? "Shop doesn't deliver here" : p.isFull ? "Plan is full" : quote.data ? `Subscribe · ${formatINR(quote.data.breakdown.total)}` : "Subscribe"}
          disabled={!canSubscribe || (isLoggedIn && !quote.data)}
          loading={subscribe.isPending}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant={bold ? "h3" : "body"} color={muted ? colors.ink500 : colors.ink900} style={styles.flex}>
        {label}
      </Text>
      <Text variant={bold ? "h3" : "body"} color={muted ? colors.ink500 : colors.ink900}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  hero: { flexDirection: "row", gap: spacing.md },
  image: { width: 96, height: 96, borderRadius: radius.control, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  dateRail: { gap: spacing.sm },
  breakdown: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md },
  total: { borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed", paddingTop: spacing.sm },
  bar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
});
