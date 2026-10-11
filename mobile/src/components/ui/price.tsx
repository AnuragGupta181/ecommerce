import { StyleSheet, View } from "react-native";
import { formatINR } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Text } from "./text";

/** Selling price is the hero; MRP struck through; discount in green (docs/DESIGN.md). */
export function Price({ price, mrp, discountPercent, large }: { price: number; mrp: number; discountPercent: number; large?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="price" style={large ? styles.large : styles.normal}>
        {formatINR(price)}
      </Text>
      {mrp > price ? (
        <Text variant="small" color={colors.ink500} style={styles.strike}>
          {formatINR(mrp)}
        </Text>
      ) : null}
      {discountPercent > 0 ? (
        <Text variant="small" color={colors.success} style={styles.off}>
          {discountPercent}% off
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6 },
  normal: { fontSize: 15, lineHeight: 20 },
  large: { fontSize: 24, lineHeight: 30 },
  strike: { textDecorationLine: "line-through" },
  off: { fontFamily: "PlusJakartaSans_700Bold" },
});
