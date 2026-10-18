import { router } from "expo-router";
import { ArrowLeftRight, Store } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { OfferBadge, shopLabel, shopMeta } from "@/components/shop/shop-status";
import { Button } from "@/components/ui/button";
import { OptionRow } from "@/components/ui/option-row";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useCartShops, useSwitchShop } from "@/hooks/use-cart";
import { errorMessage } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import type { Shop } from "@/lib/types";

/** A cart is one shop's order. Show which, warn if it can't deliver now, and offer other shops that stock the same items. */
export function CartShopHeader({ shop, deliverable }: { shop: Shop; deliverable: boolean }) {
  const [open, setOpen] = useState(false);
  const shops = useCartShops(open);
  const switchShop = useSwitchShop();
  const problem = !deliverable ? (shop.deliverable ? (shop.statusMessage ?? "This shop is closed right now.") : "This shop doesn't deliver to your location.") : null;

  return (
    <View style={[styles.box, problem ? styles.warn : null]}>
      <View style={styles.row}>
        <Store size={18} color={colors.ink900} />
        <Pressable style={styles.text} accessibilityRole="link" onPress={() => router.push(`/shop/${shop.vendorSlug}`)}>
          <Text variant="h3" numberOfLines={1}>
            {shop.vendorName}
          </Text>
          <Text variant="small" color={colors.ink500}>
            {shopMeta(shop, formatINR)}
          </Text>
        </Pressable>
        <OfferBadge label={shopLabel(shop)} />
      </View>
      {problem ? (
        <Text variant="small" color={colors.danger}>
          {problem}
        </Text>
      ) : null}
      <Button title="Switch shop" variant="outline" small icon={<ArrowLeftRight size={14} color={colors.ink900} />} onPress={() => setOpen(true)} style={styles.switch} />

      <Sheet visible={open} title="Order from another shop" onClose={() => setOpen(false)}>
        <Text variant="small" color={colors.ink500}>
          Items another shop doesn&apos;t stock stay in your cart but can&apos;t be ordered from it.
        </Text>
        {shops.isPending ? <ActivityIndicator color={colors.brand600} /> : null}
        {shops.data?.length === 0 ? <Text color={colors.ink500}>No other shop nearby stocks these items.</Text> : null}
        {shops.data?.map((option) => (
          <OptionRow
            key={option.branchId}
            label={option.vendorName}
            description={`${option.availableItems} of ${option.totalItems} items · ${formatINR(option.itemsTotal)} · ${shopMeta(option, formatINR)}`}
            selected={option.isCurrent}
            right={<OfferBadge label={shopLabel(option)} />}
            onPress={() => {
              if (option.isCurrent) return setOpen(false);
              switchShop.mutate(option.branchId, {
                onSuccess: () => setOpen(false),
                onError: (error) => Alert.alert("Couldn't switch shop", errorMessage(error)),
              });
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  warn: { borderColor: colors.danger },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  text: { flex: 1 },
  switch: { alignSelf: "flex-start" },
});
