import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { formatINR } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

/** Sticky footer: server total on the left, primary action on the right. */
export function PayBar({ payable, savings, label, onPress, loading, disabled, bottomOffset = 0 }: { payable: number; savings?: number; label: string; onPress: () => void; loading?: boolean; disabled?: boolean; bottomOffset?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: (bottomOffset || insets.bottom) + spacing.md }]}>
      <View style={styles.total}>
        <Text variant="price">{formatINR(payable)}</Text>
        {savings ? (
          <Text variant="small" color={colors.success}>
            Saving {formatINR(savings)}
          </Text>
        ) : null}
      </View>
      <Button title={label} onPress={onPress} loading={loading} disabled={disabled} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  total: { flex: 1 },
  button: { flex: 1.3 },
});
