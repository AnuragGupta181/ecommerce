import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { errorMessage } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { Button } from "./button";
import { Skeleton, type SkeletonLayout } from "./skeleton";
import { Text } from "./text";

/** First load of a screen: a skeleton shaped like the page, not a spinner. */
export function Loading({ layout = "list" }: { layout?: SkeletonLayout }) {
  return <Skeleton layout={layout} />;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text variant="h3">Something went wrong</Text>
      <Text color={colors.ink500} style={styles.text}>
        {errorMessage(error)}
      </Text>
      {onRetry ? <Button title="Try again" variant="outline" small onPress={onRetry} /> : null}
    </View>
  );
}

/** Line icon in a brand-100 circle, a short title and one action (docs/DESIGN.md). */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: { icon: LucideIcon; title: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.center}>
      <View style={styles.badge}>
        <Icon size={26} color={colors.ink900} strokeWidth={1.75} />
      </View>
      <Text variant="h2">{title}</Text>
      {description ? (
        <Text color={colors.ink500} style={styles.text}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl, minHeight: 280 },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center" },
  text: { textAlign: "center" },
  action: { marginTop: spacing.sm, minWidth: 180 },
});
