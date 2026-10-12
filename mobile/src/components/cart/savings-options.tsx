import { Coins, Tag, X } from "lucide-react-native";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Text } from "@/components/ui/text";
import { formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import type { PriceSummary } from "@/lib/types";

/** Coupon row and coins toggle; shared by cart and checkout. */
export function SavingsOptions({
  summary,
  coupon,
  useCoins,
  onOpenCoupons,
  onClearCoupon,
  onToggleCoins,
}: {
  summary: PriceSummary;
  coupon?: string;
  useCoins: boolean;
  onOpenCoupons: () => void;
  onClearCoupon: () => void;
  onToggleCoins: (value: boolean) => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.row} onPress={onOpenCoupons} accessibilityRole="button">
        <Tag size={20} color={colors.ink900} />
        <View style={styles.flex}>
          {coupon && !summary.couponError ? (
            <>
              <Text variant="h3">{coupon} applied</Text>
              <Text variant="small" color={colors.success}>
                You save {formatINR(summary.couponDiscount)}
              </Text>
            </>
          ) : (
            <>
              <Text variant="h3">Apply coupon</Text>
              {coupon && summary.couponError ? (
                <Text variant="small" color={colors.danger}>
                  {coupon}: {summary.couponError}
                </Text>
              ) : (
                <Text variant="small" color={colors.ink500}>
                  See offers for this cart
                </Text>
              )}
            </>
          )}
        </View>
        {coupon ? (
          <Pressable accessibilityLabel="Remove coupon" hitSlop={8} onPress={onClearCoupon}>
            <X size={18} color={colors.ink500} />
          </Pressable>
        ) : null}
      </Pressable>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Coins size={20} color={colors.brand700} />
        <View style={styles.flex}>
          <Text variant="h3">Use Haat coins</Text>
          <Text variant="small" color={colors.ink500}>
            {summary.coinsAvailable > 0
              ? `Balance ${summary.coinsAvailable} · up to ${summary.coinsRedeemable} usable on this order`
              : "No coins yet. Earn them on delivered orders."}
          </Text>
        </View>
        <Switch
          value={useCoins}
          disabled={summary.coinsRedeemable === 0}
          onValueChange={onToggleCoins}
          trackColor={{ true: colors.brand500, false: colors.line }}
          thumbColor={colors.surface}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  divider: { height: 1, backgroundColor: colors.line },
});
