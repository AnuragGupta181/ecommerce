import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { AddressLines } from "@/components/account/address-card";
import { CouponSheet } from "@/components/cart/coupon-sheet";
import { PayBar } from "@/components/cart/pay-bar";
import { PriceDetails } from "@/components/cart/price-details";
import { SavingsOptions } from "@/components/cart/savings-options";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionRow } from "@/components/ui/option-row";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useAddresses } from "@/hooks/use-account";
import { usePlaceOrder, useQuote, type CheckoutInput } from "@/hooks/use-cart";
import { useSettings } from "@/hooks/use-catalog";
import { errorMessage } from "@/lib/api";
import { isShopUnavailable } from "@/lib/cart-conflict";
import { formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";

type PaymentMethod = "COD" | "UPI_ON_DELIVERY";

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ coupon?: string; useCoins?: string; variantId?: string; quantity?: string; branchId?: string }>();
  const [coupon, setCoupon] = useState(params.coupon || undefined);
  const [useCoins, setUseCoins] = useState(params.useCoins === "1");
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [addressId, setAddressId] = useState<string>();
  const [payment, setPayment] = useState<PaymentMethod>();
  const [note, setNote] = useState("");

  // "Buy now" checks out a single item without touching the cart.
  const items = params.variantId ? [{ variantId: params.variantId, quantity: Number(params.quantity) || 1 }] : undefined;
  const addresses = useAddresses();
  const address = addresses.data?.find((a) => a.id === addressId) ?? addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];
  // The quote is priced for the chosen address, so the delivery fee matches what the order will charge.
  const input: CheckoutInput = { couponCode: coupon, useCoins: useCoins || undefined, items, branchId: items && params.branchId ? params.branchId : undefined };
  const quote = useQuote({ ...input, addressId: address?.id });
  const settings = useSettings();
  const place = usePlaceOrder();

  const methods: { value: PaymentMethod; label: string; description: string }[] = [
    ...(settings.data?.codEnabled !== false ? [{ value: "COD" as const, label: "Cash on delivery", description: "Pay in cash when your order arrives" }] : []),
    ...(settings.data?.upiOnDeliveryEnabled !== false ? [{ value: "UPI_ON_DELIVERY" as const, label: "UPI on delivery", description: "Scan and pay the rider at your door" }] : []),
  ];
  const method = payment ?? methods[0]?.value;

  const submit = () => {
    if (!address || !method) return;
    place.mutate(
      { ...input, couponCode: quote.data?.summary.couponError ? undefined : coupon, addressId: address.id, paymentMethod: method, note: note.trim() || undefined },
      {
        onSuccess: (order) =>
          router.replace({ pathname: "/order-success", params: { id: order.id, orderNumber: order.orderNumber, payable: String(order.payable), coins: String(order.coinsToEarn) } }),
        onError: (error) =>
          isShopUnavailable(error)
            ? Alert.alert("Shop can't deliver now", `${errorMessage(error)} Go back to your cart to switch to another shop.`, [{ text: "Open cart", onPress: () => router.replace("/cart") }, { text: "Close", style: "cancel" }])
            : Alert.alert("Couldn't place order", errorMessage(error)),
      },
    );
  };

  return (
    <Screen>
      <StackHeader title="Checkout" />
      {quote.isPending ? (
        <Loading />
      ) : quote.isError ? (
        <ErrorState error={quote.error} onRetry={() => quote.refetch()} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Card
              title="Deliver to"
              right={address ? <Button title="Add new" variant="ghost" small onPress={() => router.push("/account/address-form")} /> : null}
            >
              {addresses.isPending ? (
                <Loading />
              ) : !addresses.data?.length ? (
                <Button title="Add a delivery address" variant="outline" icon={<Plus size={18} color={colors.ink900} />} onPress={() => router.push("/account/address-form")} />
              ) : (
                addresses.data.map((a) => (
                  <OptionRow key={a.id} label={`${a.type.charAt(0)}${a.type.slice(1).toLowerCase()}${a.isDefault ? " · Default" : ""}`} selected={a.id === address?.id} onPress={() => setAddressId(a.id)} />
                ))
              )}
              {address ? <AddressLines address={address} /> : null}
            </Card>

            <Card title={`Items (${quote.data.summary.itemCount})`}>
              {quote.data.items.map((line) => (
                <View key={line.id} style={styles.line}>
                  <Image source={line.product.imageUrl} style={styles.thumb} contentFit="contain" />
                  <View style={styles.flex}>
                    <Text numberOfLines={1}>{line.product.name}</Text>
                    <Text variant="small" color={colors.ink500}>
                      {line.variant.label ? `${line.variant.label} · ` : ""}Qty {line.quantity}
                    </Text>
                    {!line.available ? (
                      <Text variant="small" color={colors.danger}>
                        {line.unavailableReason ?? "Unavailable"}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="h3">{formatINR(line.lineTotal)}</Text>
                </View>
              ))}
            </Card>

            <SavingsOptions
              summary={quote.data.summary}
              coupon={coupon}
              useCoins={useCoins}
              onOpenCoupons={() => setCouponsOpen(true)}
              onClearCoupon={() => setCoupon(undefined)}
              onToggleCoins={setUseCoins}
            />

            <Card title="Payment">
              {methods.map((m) => (
                <OptionRow key={m.value} label={m.label} description={m.description} selected={method === m.value} onPress={() => setPayment(m.value)} />
              ))}
              {methods.length === 0 ? <Text color={colors.danger}>The store isn’t accepting orders right now.</Text> : null}
            </Card>

            <Input label="Delivery note (optional)" placeholder="E.g. ring the bell twice" value={note} onChangeText={setNote} maxLength={200} />

            <PriceDetails summary={quote.data.summary} />
          </ScrollView>
          <PayBar
            payable={quote.data.summary.payable}
            savings={quote.data.summary.totalSavings}
            label="Place order"
            loading={place.isPending}
            disabled={!address || !method || quote.data.items.some((line) => !line.available)}
            onPress={submit}
          />
        </>
      )}
      <CouponSheet visible={couponsOpen} onClose={() => setCouponsOpen(false)} onApply={setCoupon} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 48, height: 48, borderRadius: radius.control, backgroundColor: colors.canvas },
  flex: { flex: 1 },
});
