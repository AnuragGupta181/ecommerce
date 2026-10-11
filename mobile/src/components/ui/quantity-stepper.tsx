import { Minus, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "@/lib/theme";
import { Text } from "./text";

export function QuantityStepper({ value, max, onChange, disabled }: { value: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <View style={styles.box}>
      <Pressable accessibilityLabel="Decrease quantity" hitSlop={8} disabled={disabled || value <= 1} onPress={() => onChange(value - 1)} style={styles.button}>
        <Minus size={16} color={value <= 1 ? colors.ink300 : colors.ink900} />
      </Pressable>
      <Text variant="h3" style={styles.value}>
        {value}
      </Text>
      <Pressable accessibilityLabel="Increase quantity" hitSlop={8} disabled={disabled || value >= max} onPress={() => onChange(value + 1)} style={styles.button}>
        <Plus size={16} color={value >= max ? colors.ink300 : colors.ink900} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, height: 36 },
  button: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  value: { minWidth: 24, textAlign: "center" },
});
