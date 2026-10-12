import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useCartCoupons } from "@/hooks/use-cart";
import { formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";

/** The server decides applicability; this only lists what it says and passes the code back. */
export function CouponSheet({ visible, onClose, onApply }: { visible: boolean; onClose: () => void; onApply: (code: string) => void }) {
  const coupons = useCartCoupons(visible);
  const [code, setCode] = useState("");
  const apply = (value: string) => {
    onApply(value.trim().toUpperCase());
    setCode("");
    onClose();
  };

  return (
    <Sheet visible={visible} title="Apply coupon" onClose={onClose}>
      <View style={styles.manual}>
        <View style={styles.flex}>
          <Input placeholder="Enter coupon code" autoCapitalize="characters" value={code} onChangeText={setCode} />
        </View>
        <Button title="Apply" small disabled={!code.trim()} onPress={() => apply(code)} style={styles.applyButton} />
      </View>
      {coupons.isPending ? <ActivityIndicator color={colors.brand600} /> : null}
      {coupons.data?.map((coupon) => (
        <View key={coupon.code} style={[styles.coupon, !coupon.applicable && styles.muted]}>
          <View style={styles.flex}>
            <View style={styles.codeTag}>
              <Text variant="small" style={styles.bold}>
                {coupon.code}
              </Text>
            </View>
            <Text variant="h3">{coupon.title}</Text>
            <Text variant="small" color={colors.ink500}>
              {coupon.description}
            </Text>
            {coupon.minOrderValue ? (
              <Text variant="small" color={colors.ink500}>
                Min order {formatINR(coupon.minOrderValue)}
              </Text>
            ) : null}
            {!coupon.applicable && coupon.reason ? (
              <Text variant="small" color={colors.danger}>
                {coupon.reason}
              </Text>
            ) : null}
          </View>
          <Button title="Apply" variant="outline" small disabled={!coupon.applicable} onPress={() => apply(coupon.code)} />
        </View>
      ))}
      {coupons.data?.length === 0 ? <Text color={colors.ink500}>No coupons available right now.</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  manual: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  flex: { flex: 1, gap: 3 },
  applyButton: { height: 48 },
  coupon: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, borderStyle: "dashed" },
  muted: { opacity: 0.6 },
  codeTag: { alignSelf: "flex-start", backgroundColor: colors.brand100, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
});
