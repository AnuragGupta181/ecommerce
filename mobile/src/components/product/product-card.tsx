import { Image } from "expo-image";
import { router } from "expo-router";
import { Heart } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Price } from "@/components/ui/price";
import { RatingChip } from "@/components/ui/rating-chip";
import { Text } from "@/components/ui/text";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useToggleWishlist } from "@/hooks/use-wishlist";
import { formatDistance } from "@/lib/geo";
import { colors, radius, spacing } from "@/lib/theme";
import type { ProductCard as Card } from "@/lib/types";

export function ProductCard({ product, width }: { product: Card; width?: number }) {
  const { guard } = useRequireAuth();
  const toggle = useToggleWishlist();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={product.name}
      onPress={() => router.push(`/product/${product.slug}`)}
      style={({ pressed }) => [styles.card, width ? { width } : styles.flex, pressed && styles.pressed]}
    >
      <View style={styles.imageBox}>
        <Image source={product.imageUrl} style={styles.image} contentFit="contain" transition={150} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={product.isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          hitSlop={8}
          style={styles.heart}
          onPress={() => guard(() => toggle.mutate({ productId: product.id, wishlisted: product.isWishlisted }), "Login to save items to your wishlist")}
        >
          <Heart size={18} color={product.isWishlisted ? colors.danger : colors.ink500} fill={product.isWishlisted ? colors.danger : "transparent"} />
        </Pressable>
        {!product.inStock ? (
          <View style={styles.soldOut}>
            <Text variant="small" color={colors.danger}>
              Out of stock
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {product.brand ? (
          <Text variant="small" color={colors.ink500} numberOfLines={1}>
            {product.brand}
          </Text>
        ) : null}
        <Text numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
        <RatingChip rating={product.ratingAvg} count={product.ratingCount} />
        <Price price={product.price} mrp={product.mrp} discountPercent={product.discountPercent} />
        {product.shop ? (
          <Text variant="small" color={product.shop.label === "AVAILABLE" ? colors.ink500 : colors.warning} numberOfLines={1}>
            {[product.shop.vendorName, formatDistance(product.shop.distanceKm), SHOP_STATE[product.shop.label]].filter(Boolean).join(" · ")}
            {product.shopCount && product.shopCount > 1 ? ` +${product.shopCount - 1}` : ""}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const SHOP_STATE = { AVAILABLE: null, CLOSED: "closed now", OUT_OF_STOCK: "out of stock", TOO_FAR: "too far" } as const;

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  // Caps a lone last item in a two-column grid at half width.
  flex: { flex: 1, maxWidth: "50%" },
  pressed: { transform: [{ scale: 0.98 }] },
  imageBox: { aspectRatio: 1, backgroundColor: colors.canvas },
  image: { flex: 1, margin: spacing.sm },
  heart: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  soldOut: { position: "absolute", left: 8, bottom: 8, backgroundColor: colors.dangerSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  body: { padding: spacing.md, gap: 4 },
  name: { minHeight: 40 },
});
