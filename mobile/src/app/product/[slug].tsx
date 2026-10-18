import { router, useLocalSearchParams } from "expo-router";
import { Heart, Share2, ShoppingCart, Tag } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gallery } from "@/components/product/gallery";
import { ShopOffers } from "@/components/shop/shop-offers";
import { ProductRail } from "@/components/product/product-rail";
import { RatingSummary, ReviewRow } from "@/components/product/review-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Price } from "@/components/ui/price";
import { RatingChip } from "@/components/ui/rating-chip";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { StackHeader } from "@/components/ui/stack-header";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useAddToCartResolvingShop } from "@/hooks/use-cart";
import { useProduct, useProductReviews, useSimilarProducts } from "@/hooks/use-catalog";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useToggleWishlist } from "@/hooks/use-wishlist";
import { deviceStore } from "@/lib/device-store";
import { openListing } from "@/lib/navigation";
import { colors, spacing } from "@/lib/theme";

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const product = useProduct(slug);
  const similar = useSimilarProducts(slug);
  const insets = useSafeAreaInsets();
  const { guard } = useRequireAuth();
  const toggleWishlist = useToggleWishlist();
  const addToCart = useAddToCartResolvingShop();
  const [variantId, setVariantId] = useState<string>();
  const [listingId, setListingId] = useState<string>();
  const [added, setAdded] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  const data = product.data;
  useEffect(() => {
    if (data) deviceStore.addRecentlyViewed(data.id);
  }, [data]);

  if (product.isPending) {
    return (
      <Screen>
        <StackHeader title="" />
        <Loading />
      </Screen>
    );
  }
  if (product.isError) {
    return (
      <Screen>
        <StackHeader title="" />
        <ErrorState error={product.error} onRetry={() => product.refetch()} />
      </Screen>
    );
  }

  const p = product.data;
  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants.find((v) => v.inStock) ?? p.variants[0];
  // The server ranks offers best-first; the shopper may pick another shop that can deliver.
  const offers = variant?.offers ?? [];
  const offer = offers.find((o) => o.listingId === listingId && o.label === "AVAILABLE") ?? offers.find((o) => o.label === "AVAILABLE") ?? offers[0];
  const shown = offer ?? variant;
  const buyable = offer ? offer.label === "AVAILABLE" : !!variant?.inStock;
  const discount = offer ? offer.discountPercent : variant && variant.mrp > variant.price ? Math.round(((variant.mrp - variant.price) / variant.mrp) * 100) : 0;
  const stockLeft = offer ? offer.stockLeft : variant?.stock;
  const lowStock = stockLeft !== null && stockLeft !== undefined && stockLeft > 0 && stockLeft <= 5;

  const add = () =>
    guard(() => {
      if (!variant) return;
      addToCart.add({ variantId: variant.id, quantity: 1, branchId: offer?.shop.branchId }, { onAdded: () => setAdded(true) });
    }, "Login to add items to your cart");

  return (
    <Screen>
      <StackHeader
        title=""
        right={
          <>
            <Pressable accessibilityLabel="Share" hitSlop={8} onPress={() => Share.share({ message: `${p.name} on Haat` })}>
              <Share2 size={22} color={colors.ink900} />
            </Pressable>
            <Pressable
              accessibilityLabel={p.isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              hitSlop={8}
              onPress={() => guard(() => toggleWishlist.mutate({ productId: p.id, wishlisted: p.isWishlisted }), "Login to save items to your wishlist")}
            >
              <Heart size={22} color={p.isWishlisted ? colors.danger : colors.ink900} fill={p.isWishlisted ? colors.danger : "transparent"} />
            </Pressable>
            <Pressable accessibilityLabel="Cart" hitSlop={8} onPress={() => router.push("/cart")}>
              <ShoppingCart size={22} color={colors.ink900} />
            </Pressable>
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Gallery images={p.images} />
        <View style={styles.section}>
          {p.brand ? (
            <Pressable onPress={() => openListing({ brand: p.brand?.slug ?? "" }, p.brand?.name)}>
              <Text variant="small" color={colors.brand700} style={styles.bold}>
                {p.brand.name}
              </Text>
            </Pressable>
          ) : null}
          <Text variant="h2">{p.name}</Text>
          <RatingChip rating={p.rating.average} count={p.rating.count} />
          {shown ? <Price price={shown.price} mrp={shown.mrp} discountPercent={discount} large /> : null}
          {!buyable ? (
            <Text color={colors.danger} style={styles.bold}>
              {offer?.label === "CLOSED" ? "Shop closed right now" : offer?.label === "TOO_FAR" ? "No shop delivers here yet" : "Out of stock"}
            </Text>
          ) : lowStock ? (
            <Text color={colors.warning} style={styles.bold}>
              Only {stockLeft} left
            </Text>
          ) : null}
        </View>

        {p.variants.length > 1 ? (
          <View style={styles.section}>
            <Text variant="h3">Options</Text>
            <View style={styles.chips}>
              {p.variants.map((v) => (
                <Chip key={v.id} label={v.inStock ? v.label : `${v.label} (sold out)`} selected={v.id === variant?.id} onPress={() => setVariantId(v.id)} />
              ))}
            </View>
          </View>
        ) : null}

        {variant?.offers ? <ShopOffers offers={variant.offers} selectedListingId={offer?.listingId} onSelect={(o) => setListingId(o.listingId)} /> : null}

        {p.offers.length ? (
          <Card title="Available offers" style={styles.card}>
            {p.offers.map((offer) => (
              <View key={offer.code} style={styles.offer}>
                <Tag size={16} color={colors.success} />
                <Text style={styles.flex}>
                  <Text style={styles.bold}>{offer.code}</Text> · {offer.title}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {p.highlights.length ? (
          <Card title="Highlights" style={styles.card}>
            {p.highlights.map((highlight) => (
              <Text key={highlight} color={colors.ink700}>
                • {highlight}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card title="Description" style={styles.card}>
          <Text color={colors.ink700}>{p.description}</Text>
        </Card>

        {p.specs.length ? (
          <Card title="Specifications" style={styles.card}>
            {p.specs.map((spec) => (
              <View key={spec.label} style={styles.spec}>
                <Text color={colors.ink500} style={styles.specLabel}>
                  {spec.label}
                </Text>
                <Text style={styles.flex}>{spec.value}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card
          title="Ratings & reviews"
          style={styles.card}
          right={
            p.rating.count > p.topReviews.length ? (
              <Pressable hitSlop={8} onPress={() => setReviewsOpen(true)}>
                <Text variant="small" color={colors.brand700} style={styles.bold}>
                  See all
                </Text>
              </Pressable>
            ) : null
          }
        >
          {p.rating.count ? <RatingSummary rating={p.rating} /> : <Text color={colors.ink500}>No reviews yet. Buy it and be the first to review.</Text>}
          {p.topReviews.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </Card>

        {similar.data?.length ? (
          <View style={styles.similar}>
            <ProductRail title="Similar products" products={similar.data} onSeeAll={() => openListing({ category: p.category.slug }, p.category.name)} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={added ? "Go to cart" : "Add to cart"}
          variant="outline"
          style={styles.flex}
          disabled={!buyable}
          loading={addToCart.isPending}
          onPress={() => (added ? router.push("/cart") : add())}
        />
        <Button
          title="Buy now"
          style={styles.flex}
          disabled={!buyable}
          onPress={() =>
            guard(
              () => variant && router.push({ pathname: "/checkout", params: { variantId: variant.id, quantity: "1", branchId: offer?.shop.branchId ?? "" } }),
              "Login to buy this item",
            )
          }
        />
      </View>

      {reviewsOpen ? <AllReviews productId={p.id} onClose={() => setReviewsOpen(false)} /> : null}
    </Screen>
  );
}

function AllReviews({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [sort, setSort] = useState("recent");
  const reviews = useProductReviews(productId, sort);
  const items = reviews.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Sheet visible title="All reviews" onClose={onClose}>
      <View style={styles.chips}>
        {[
          ["recent", "Most recent"],
          ["rating_high", "Highest rated"],
          ["rating_low", "Lowest rated"],
        ].map(([value, label]) => (
          <Chip key={value} label={label} selected={sort === value} onPress={() => setSort(value)} />
        ))}
      </View>
      {reviews.isPending ? <ActivityIndicator color={colors.brand600} /> : null}
      {items.map((review) => (
        <ReviewRow key={review.id} review={{ ...review, userName: review.userName ?? review.user?.name ?? "Customer" }} />
      ))}
      {reviews.hasNextPage ? <Button title="Load more" variant="ghost" loading={reviews.isFetchingNextPage} onPress={() => reviews.fetchNextPage()} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  section: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: { marginHorizontal: spacing.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
  offer: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  flex: { flex: 1 },
  spec: { flexDirection: "row", gap: spacing.md },
  specLabel: { width: 120 },
  similar: { marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
});
