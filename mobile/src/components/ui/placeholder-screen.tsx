import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "@/lib/theme";
import { Screen } from "./screen";
import { Text } from "./text";

/** Temporary body for scaffolded routes until their feature lands (docs/PLAN.md, Phase 5). */
export function PlaceholderScreen({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.badge}>
          <Icon size={24} color={colors.ink900} strokeWidth={1.75} />
        </View>
        <Text variant="h2">{title}</Text>
        <Text color={colors.ink500} style={styles.description}>
          {description}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center" },
  description: { textAlign: "center" },
});
