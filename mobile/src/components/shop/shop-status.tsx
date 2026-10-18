import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { formatDistance } from "@/lib/geo";
import { colors, radius } from "@/lib/theme";
import type { OfferLabel, Shop } from "@/lib/types";

const LABELS: Record<OfferLabel, { text: string; fg: string; bg: string }> = {
  AVAILABLE: { text: "Open", fg: colors.success, bg: colors.successSoft },
  CLOSED: { text: "Closed", fg: colors.ink700, bg: colors.canvas },
  OUT_OF_STOCK: { text: "Out of stock", fg: colors.danger, bg: colors.dangerSoft },
  TOO_FAR: { text: "Too far", fg: colors.warning, bg: colors.brand50 },
};

export function OfferBadge({ label }: { label: OfferLabel }) {
  const style = LABELS[label];
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text variant="small" color={style.fg}>
        {style.text}
      </Text>
    </View>
  );
}

/** Label for a shop on its own (no item): open, closed with its reason, or out of range. */
export function shopLabel(shop: Shop): OfferLabel {
  if (!shop.deliverable) return "TOO_FAR";
  return shop.isOpen ? "AVAILABLE" : "CLOSED";
}

/** "1.2 km · ₹15 delivery" style line; the fee is the server's figure for this location. */
export function shopMeta(shop: Shop, formatFee: (paise: number) => string): string {
  const distance = formatDistance(shop.distanceKm);
  const fee = shop.deliveryFee === 0 ? "Free delivery" : `${formatFee(shop.deliveryFee)} delivery`;
  return [distance, fee].filter(Boolean).join(" · ");
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
});
