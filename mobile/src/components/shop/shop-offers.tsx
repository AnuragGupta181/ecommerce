import { router } from "expo-router";
import { Store } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { formatINR } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import type { ShopOffer } from "@/lib/types";
import { OfferBadge, shopMeta } from "./shop-status";

/**
 * Every shop selling this variant, ranked by the server (available, then closed, out of stock,
 * too far; nearest first). The shopper can pick any offer they could actually buy.
 */
export function ShopOffers({ offers, selectedListingId, onSelect }: { offers: ShopOffer[]; selectedListingId: string | undefined; onSelect: (offer: ShopOffer) => void }) {
  if (offers.length === 0) {
    return (
      <Card title="Sold by" style={styles.card}>
        <Text color={colors.ink500}>No shop near you sells this right now.</Text>
      </Card>
    );
  }
  return (
    <Card title={offers.length > 1 ? `Sold by ${offers.length} shops` : "Sold by"} style={styles.card}>
      {offers.map((offer) => {
        const selected = offer.listingId === selectedListingId;
        const buyable = offer.label === "AVAILABLE";
        return (
          <Pressable
            key={offer.listingId}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !buyable }}
            disabled={!buyable}
            onPress={() => onSelect(offer)}
            style={[styles.row, selected && styles.selected, !buyable && styles.muted]}
          >
            <View style={styles.text}>
              <Text variant="h3" numberOfLines={1}>
                {offer.shop.vendorName}
              </Text>
              <Text variant="small" color={colors.ink500}>
                {shopMeta(offer.shop, formatINR)}
              </Text>
              {offer.shop.statusMessage && offer.label === "CLOSED" ? (
                <Text variant="small" color={colors.ink500}>
                  {offer.shop.statusMessage}
                </Text>
              ) : null}
              {offer.stockLeft ? (
                <Text variant="small" color={colors.warning}>
                  Only {offer.stockLeft} left
                </Text>
              ) : null}
            </View>
            <View style={styles.price}>
              <Text variant="h3">{formatINR(offer.price)}</Text>
              <OfferBadge label={offer.label} />
            </View>
            <Pressable accessibilityRole="link" accessibilityLabel={`Open ${offer.shop.vendorName}`} hitSlop={8} onPress={() => router.push(`/shop/${offer.shop.vendorSlug}`)}>
              <Store size={18} color={colors.ink700} />
            </Pressable>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line },
  selected: { borderColor: colors.brand500, backgroundColor: colors.brand50 },
  muted: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  price: { alignItems: "flex-end", gap: 4 },
});
