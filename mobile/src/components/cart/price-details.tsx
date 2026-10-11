import { StyleSheet, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { formatINR } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";
import type { PriceSummary } from "@/lib/types";

/** Every number here comes from the server; the app never computes totals. */
export function PriceDetails({ summary }: { summary: PriceSummary }) {
  const rows: [string, string, string?][] = [
    [`Price (${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"})`, formatINR(summary.itemsMrp)],
    ["Discount", `− ${formatINR(summary.mrpDiscount)}`, colors.success],
  ];
  if (summary.couponDiscount) rows.push([`Coupon ${summary.couponCode ?? ""}`, `− ${formatINR(summary.couponDiscount)}`, colors.success]);
  if (summary.coinsDiscount) rows.push([`Coins (${summary.coinsUsed})`, `− ${formatINR(summary.coinsDiscount)}`, colors.success]);
  rows.push(["Delivery", summary.deliveryFee ? formatINR(summary.deliveryFee) : "FREE", summary.deliveryFee ? undefined : colors.success]);

  return (
    <Card title="Price details">
      {rows.map(([label, value, color]) => (
        <View key={label} style={styles.row}>
          <Text color={colors.ink700}>{label}</Text>
          <Text color={color ?? colors.ink900}>{value}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text variant="h3">Total amount</Text>
        <Text variant="price">{formatINR(summary.payable)}</Text>
      </View>
      {summary.amountForFreeDelivery > 0 ? (
        <Text variant="small" color={colors.brand700}>
          Add {formatINR(summary.amountForFreeDelivery)} more for free delivery
        </Text>
      ) : null}
      {summary.totalSavings > 0 ? (
        <View style={styles.savings}>
          <Text variant="small" color={colors.success} style={styles.bold}>
            You will save {formatINR(summary.totalSavings)} on this order
          </Text>
        </View>
      ) : null}
      {summary.coinsToEarn > 0 ? (
        <Text variant="small" color={colors.brand700}>
          You'll earn {summary.coinsToEarn} coins when this order is delivered
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  divider: { borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.line, marginVertical: spacing.xs },
  savings: { backgroundColor: colors.successSoft, borderRadius: 8, padding: spacing.sm },
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
});
