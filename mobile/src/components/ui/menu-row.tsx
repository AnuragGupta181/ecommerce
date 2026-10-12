import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "@/lib/theme";
import { Text } from "./text";

export function MenuRow({ icon: Icon, label, hint, onPress, danger }: { icon: LucideIcon; label: string; hint?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Icon size={20} color={danger ? colors.danger : colors.ink900} strokeWidth={1.75} />
      <Text variant="h3" color={danger ? colors.danger : colors.ink900} style={styles.label}>
        {label}
      </Text>
      {hint ? (
        <Text variant="small" color={colors.ink500}>
          {hint}
        </Text>
      ) : null}
      {danger ? null : <ChevronRight size={18} color={colors.ink300} />}
    </Pressable>
  );
}

export function MenuGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, height: 54, borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { backgroundColor: colors.canvas },
  label: { flex: 1 },
});
