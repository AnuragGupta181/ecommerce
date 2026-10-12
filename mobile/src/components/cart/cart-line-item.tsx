import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Price } from "@/components/ui/price";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Text } from "@/components/ui/text";
import { useRemoveCartItem, useSaveForLater, useUpdateCartItem } from "@/hooks/use-cart";
import { colors, radius, spacing } from "@/lib/theme";
import type { CartLine } from "@/lib/types";

export function CartLineItem({ line }: { line: CartLine }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const saveForLater = useSaveForLater();
  const busy = update.isPending || remove.isPending || saveForLater.isPending;
  const discount = line.lineMrp > line.lineTotal ? Math.round(((line.lineMrp - line.lineTotal) / line.lineMrp) * 100) : 0;

  return (
    <View style={[styles.card, busy && styles.busy]}>
      <Pressable style={styles.top} onPress={() => router.push(`/product/${line.product.slug}`)}>
        <Image source={line.product.imageUrl} style={styles.image} contentFit="contain" />
        <View style={styles.info}>
          {line.product.brand ? (
            <Text variant="small" color={colors.ink500}>
              {line.product.brand}
            </Text>
          ) : null}
          <Text numberOfLines={2}>{line.product.name}</Text>
          {line.variant.label ? (
            <Text variant="small" color={colors.ink500}>
              {line.variant.label}
            </Text>
          ) : null}
          <Price price={line.lineTotal} mrp={line.lineMrp} discountPercent={discount} />
          {!line.available ? (
            <Text variant="small" color={colors.danger}>
              {line.unavailableReason ?? "Currently unavailable"}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <QuantityStepper value={line.quantity} max={Math.max(line.maxQuantity, 1)} disabled={busy || !line.available} onChange={(quantity) => update.mutate({ id: line.id, quantity })} />
        <View style={styles.links}>
          <Pressable hitSlop={8} disabled={busy} onPress={() => saveForLater.mutate(line.id)}>
            <Text variant="small" style={styles.link}>
              Save for later
            </Text>
          </Pressable>
          <Pressable hitSlop={8} disabled={busy} onPress={() => remove.mutate(line.id)}>
            <Text variant="small" color={colors.danger} style={styles.link}>
              Remove
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md },
  busy: { opacity: 0.6 },
  top: { flexDirection: "row", gap: spacing.md },
  image: { width: 80, height: 80, borderRadius: radius.control, backgroundColor: colors.canvas },
  info: { flex: 1, gap: 3 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  links: { flexDirection: "row", gap: spacing.lg },
  link: { fontFamily: "PlusJakartaSans_700Bold" },
});
