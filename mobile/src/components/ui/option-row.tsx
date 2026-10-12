import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import { Text } from "./text";

/** Radio-style row used in sheets and checkout. */
export function OptionRow({ label, description, selected, onPress, right }: { label: string; description?: string; selected: boolean; onPress: () => void; right?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.dot} /> : null}</View>
      <View style={styles.text}>
        <Text variant="h3">{label}</Text>
        {description ? (
          <Text variant="small" color={colors.ink500}>
            {description}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  selected: { borderColor: colors.brand500, backgroundColor: colors.brand50 },
  pressed: { opacity: 0.85 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.ink300, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.ink900 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink900 },
  text: { flex: 1, gap: 2 },
});
