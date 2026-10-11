import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "@/lib/theme";
import { Text } from "./text";

export function StackHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back}>
        <ChevronLeft size={24} color={colors.ink900} />
      </Pressable>
      <Text variant="h2" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
