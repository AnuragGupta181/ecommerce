import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius } from "@/lib/theme";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const fills: Record<Variant, { bg: string; fg: string; border?: string }> = {
  // Ink on yellow: white on brand-500 fails contrast.
  primary: { bg: colors.brand500, fg: colors.ink900 },
  secondary: { bg: colors.ink900, fg: colors.surface },
  outline: { bg: colors.surface, fg: colors.ink900, border: colors.line },
  ghost: { bg: "transparent", fg: colors.ink900 },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.line },
};

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = "primary", loading, disabled, icon, small, style }: ButtonProps) {
  const fill = fills[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: fill.bg, borderColor: fill.border ?? fill.bg },
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fill.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant={small ? "small" : "h3"} color={fill.fg}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 48, borderRadius: radius.control, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  small: { height: 34, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
});
