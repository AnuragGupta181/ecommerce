import { Pressable, StyleSheet } from "react-native";
import { colors, radius } from "@/lib/theme";
import { Text } from "./text";

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text variant="small" color={colors.ink900}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, height: 34, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.brand100, borderColor: colors.brand500 },
  pressed: { transform: [{ scale: 0.97 }] },
});
