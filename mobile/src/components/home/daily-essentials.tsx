import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import type { Plan } from "@/lib/types";

/** Subscription plans that deliver here: milk, curd, bread every morning. */
export function DailyEssentials({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="h2">Daily essentials</Text>
        <Text variant="small" color={colors.ink500}>
          Subscribe once, delivered every morning
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {plans.map((plan) => {
          const cheapest = Math.min(...plan.prices.map((price) => price.pricePerDelivery));
          return (
            <Pressable key={plan.id} accessibilityRole="button" accessibilityLabel={plan.name} onPress={() => router.push(`/plans/${plan.id}`)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.imageBox}>
                <Image transition={200} source={plan.product.imageUrl} style={styles.image} contentFit="contain" />
              </View>
              <Text variant="h3" numberOfLines={1}>
                {plan.name}
              </Text>
              <Text variant="small" color={colors.ink500} numberOfLines={1}>
                {plan.quantityPerDelivery} × {plan.product.variantLabel} · {plan.shop.vendorName}
              </Text>
              <Text variant="small">
                from <Text variant="h3">{formatINR(cheapest)}</Text>/day
              </Text>
              {plan.isFull ? (
                <Text variant="small" color={colors.warning}>
                  Full right now
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: { paddingHorizontal: spacing.lg, gap: 2 },
  rail: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: 160, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: 4 },
  pressed: { transform: [{ scale: 0.98 }] },
  imageBox: { height: 96, borderRadius: radius.control, backgroundColor: colors.canvas, marginBottom: 4 },
  image: { flex: 1, margin: spacing.sm },
});
