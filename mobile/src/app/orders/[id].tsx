import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { MessageCircle, Phone } from "lucide-react-native";
import { useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { AddressLines } from "@/components/account/address-card";
import { ReasonSheet } from "@/components/orders/reason-sheet";
import { StatusBadge } from "@/components/orders/status-badge";
import { StatusTimeline } from "@/components/orders/status-timeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useCancelOrder, useOrder, useRequestReturn } from "@/hooks/use-orders";
import { errorMessage } from "@/lib/api";
import { formatDate, formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import { OrderShopCard } from "@/components/orders/order-shop-card";

const CANCEL_REASONS = ["Ordered by mistake", "Found a better price", "Delivery is taking too long", "Want to change items or address"];
const RETURN_REASONS = ["Item damaged or defective", "Wrong item delivered", "Item not as described", "Size or fit issue"];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const cancel = useCancelOrder();
  const requestReturn = useRequestReturn();
  const [sheet, setSheet] = useState<"cancel" | "return" | null>(null);

  if (order.isPending || order.isError) {
    return (
      <Screen backdrop="orders">
        <StackHeader title="Order details" />
        {order.isPending ? <Loading layout="detail" /> : <ErrorState error={order.error} onRetry={() => order.refetch()} />}
      </Screen>
    );
  }

  const o = order.data;
  const mutation = sheet === "return" ? requestReturn : cancel;
  const onConfirm = (reason: string) =>
    mutation.mutate(
      { id: o.id, reason },
      {
        onSuccess: () => setSheet(null),
        onError: (error) => Alert.alert(sheet === "return" ? "Couldn't request return" : "Couldn't cancel", errorMessage(error)),
      },
    );

  const rows: [string, string, string?][] = [
    ["Items total (MRP)", formatINR(o.itemsMrp)],
    ["Discount", `− ${formatINR(o.itemsMrp - o.itemsTotal)}`, colors.success],
  ];
  if (o.couponDiscount) rows.push([`Coupon ${o.couponCode ?? ""}`, `− ${formatINR(o.couponDiscount)}`, colors.success]);
  if (o.coinsUsed) rows.push(["Haat coins", `− ${o.coinsUsed} coins`, colors.success]);
  rows.push(["Delivery", o.deliveryFee ? formatINR(o.deliveryFee) : "FREE"]);

  return (
    <Screen backdrop="orders">
      <StackHeader title={`Order #${o.orderNumber}`} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => order.refetch()} tintColor={colors.brand600} />}>
        <Card title="Status" right={<StatusBadge status={o.status} />}>
          <StatusTimeline timeline={o.timeline} />
          {o.cancelReason ? <Text color={colors.ink700}>Reason: {o.cancelReason}</Text> : null}
          {o.returnReason ? <Text color={colors.ink700}>Return reason: {o.returnReason}</Text> : null}
        </Card>

        {o.rider ? (
          <Card title="Your delivery partner">
            <View style={styles.rider}>
              <View style={styles.flex}>
                <Text variant="h3">{o.rider.name}</Text>
                <Text variant="small" color={colors.ink500}>
                  {o.rider.vehicleType}
                  {o.rider.vehicleNumber ? ` · ${o.rider.vehicleNumber}` : ""}
                </Text>
              </View>
              <Pressable accessibilityLabel="Call rider" style={styles.iconButton} onPress={() => Linking.openURL(`tel:${o.rider?.phone}`)}>
                <Phone size={18} color={colors.ink900} />
              </Pressable>
              {o.rider.whatsapp ? (
                <Pressable accessibilityLabel="WhatsApp rider" style={styles.iconButton} onPress={() => Linking.openURL(`https://wa.me/${o.rider?.whatsapp?.replace(/\D/g, "")}`)}>
                  <MessageCircle size={18} color={colors.ink900} />
                </Pressable>
              ) : null}
            </View>
          </Card>
        ) : null}

        <Card title={`Items (${o.items.length})`}>
          {o.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Pressable style={styles.itemRow} onPress={() => router.push(`/product/${item.productSlug}`)}>
                <Image source={item.imageUrl} style={styles.thumb} contentFit="contain" />
                <View style={styles.flex}>
                  <Text numberOfLines={2}>{item.productName}</Text>
                  <Text variant="small" color={colors.ink500}>
                    {item.variantLabel ? `${item.variantLabel} · ` : ""}Qty {item.quantity}
                  </Text>
                </View>
                <Text variant="h3">{formatINR(item.lineTotal)}</Text>
              </Pressable>
              {item.canReview ? (
                <Button
                  title="Rate & review"
                  variant="outline"
                  small
                  style={styles.reviewButton}
                  onPress={() => router.push({ pathname: "/review", params: { productId: item.productId, name: item.productName, imageUrl: item.imageUrl ?? "" } })}
                />
              ) : null}
            </View>
          ))}
        </Card>

        <OrderShopCard order={o} />

        <Card title="Delivery address">
          <AddressLines address={o.shippingAddress} />
        </Card>

        <Card title="Payment">
          <Text color={colors.ink700}>
            {o.paymentMethod === "COD" ? "Cash on delivery" : "UPI on delivery"} · {o.paymentStatus.toLowerCase()}
          </Text>
          {rows.map(([label, value, color]) => (
            <View key={label} style={styles.row}>
              <Text color={colors.ink700}>{label}</Text>
              <Text color={color ?? colors.ink900}>{value}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text variant="h3">Total</Text>
            <Text variant="price">{formatINR(o.payable)}</Text>
          </View>
          {o.coinsEarned ? (
            <Text variant="small" color={colors.success}>
              You earned {o.coinsEarned} coins on this order
            </Text>
          ) : o.coinsToEarn ? (
            <Text variant="small" color={colors.brand700}>
              {o.coinsToEarn} coins will be credited on delivery
            </Text>
          ) : null}
          <Text variant="small" color={colors.ink500}>
            Placed on {formatDate(o.createdAt)}
          </Text>
        </Card>

        {o.actions.canCancel ? <Button title="Cancel order" variant="danger" onPress={() => setSheet("cancel")} /> : null}
        {o.actions.canReturn ? <Button title="Request return" variant="outline" onPress={() => setSheet("return")} /> : null}
      </ScrollView>

      {sheet ? (
        <ReasonSheet
          visible
          title={sheet === "cancel" ? "Why are you cancelling?" : "Why are you returning?"}
          reasons={sheet === "cancel" ? CANCEL_REASONS : RETURN_REASONS}
          confirmLabel={sheet === "cancel" ? "Cancel order" : "Request return"}
          loading={mutation.isPending}
          onClose={() => setSheet(null)}
          onConfirm={onConfirm}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  flex: { flex: 1, gap: 2 },
  rider: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center" },
  item: { gap: spacing.sm },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.control, backgroundColor: colors.canvas },
  reviewButton: { alignSelf: "flex-start" },
  row: { flexDirection: "row", justifyContent: "space-between" },
});
