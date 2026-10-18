import { router } from "expo-router";
import { Store } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { OfferBadge, shopLabel, shopMeta } from "@/components/shop/shop-status";
import { Text } from "@/components/ui/text";
import { formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import type { Shop } from "@/lib/types";

export function NearbyShops({ shops }: { shops: Shop[] }) {
  if (shops.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text variant="h2" style={styles.title}>
        Shops near you
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {shops.map((shop) => (
          <Pressable
            key={shop.branchId}
            accessibilityRole="button"
            accessibilityLabel={shop.vendorName}
            onPress={() => router.push(`/shop/${shop.vendorSlug}`)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.icon}>
              <Store size={20} color={colors.ink900} />
            </View>
            <Text variant="h3" numberOfLines={1}>
              {shop.vendorName}
            </Text>
            <Text variant="small" color={colors.ink500} numberOfLines={1}>
              {shopMeta(shop, formatINR)}
            </Text>
            <OfferBadge label={shopLabel(shop)} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  title: { paddingHorizontal: spacing.lg },
  rail: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: 180, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: 4 },
  pressed: { transform: [{ scale: 0.98 }] },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center", marginBottom: 4 },
});
