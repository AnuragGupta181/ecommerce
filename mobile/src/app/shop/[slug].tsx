import { router, useLocalSearchParams } from "expo-router";
import { MessageCircle, Phone } from "lucide-react-native";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
import { DailyEssentials } from "@/components/home/daily-essentials";
import { ProductRail } from "@/components/product/product-rail";
import { OfferBadge, shopLabel, shopMeta } from "@/components/shop/shop-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useProducts } from "@/hooks/use-catalog";
import { useVendorPage } from "@/hooks/use-marketplace";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { usePlans } from "@/hooks/use-subscriptions";
import { useOpenChat } from "@/hooks/use-support";
import { errorMessage } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { openListing } from "@/lib/navigation";
import { colors, spacing } from "@/lib/theme";

export default function ShopScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const shop = useVendorPage(slug);
  const products = useProducts({ vendor: slug, sort: "popular" });
  const plans = usePlans({ vendor: slug });
  const openChat = useOpenChat();
  const { guard } = useRequireAuth();

  if (shop.isPending) {
    return (
      <Screen backdrop="shop">
        <StackHeader title="" />
        <Loading layout="grid" />
      </Screen>
    );
  }
  if (shop.isError) {
    return (
      <Screen backdrop="shop">
        <StackHeader title="" />
        <ErrorState error={shop.error} onRetry={() => shop.refetch()} />
      </Screen>
    );
  }

  const s = shop.data;
  const items = products.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Screen backdrop="shop">
      <StackHeader title={s.shopName} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text variant="h1">{s.shopName}</Text>
          {s.description ? <Text color={colors.ink700}>{s.description}</Text> : null}
          <Text variant="small" color={colors.ink500}>
            {s.listingCount} items · {s.deliveredOrders} orders delivered
          </Text>
          <View style={styles.actions}>
            <Button
              title="Message shop"
              variant="outline"
              small
              icon={<MessageCircle size={14} color={colors.ink900} />}
              loading={openChat.isPending}
              onPress={() =>
                guard(
                  () => openChat.mutate(s.id, { onSuccess: (conversation) => router.push(`/chat/${conversation.id}`), onError: (error) => Alert.alert("Couldn't open chat", errorMessage(error)) }),
                  "Login to message the shop",
                )
              }
            />
            {s.phone ? <Button title="Call" variant="ghost" small icon={<Phone size={14} color={colors.ink900} />} onPress={() => Linking.openURL(`tel:${s.phone}`)} /> : null}
          </View>
        </View>

        <Card title={s.branches.length > 1 ? "Branches" : "Delivery"} style={styles.card}>
          {s.branches.map((branch) => (
            <View key={branch.branchId} style={styles.branch}>
              <View style={styles.flex}>
                <Text variant="h3">{branch.branchName}</Text>
                <Text variant="small" color={colors.ink500}>
                  {shopMeta(branch, formatINR)}
                  {branch.freeDeliveryAbove ? ` · free above ${formatINR(branch.freeDeliveryAbove)}` : ""}
                </Text>
                {!branch.isOpen && branch.statusMessage ? (
                  <Text variant="small" color={colors.ink500}>
                    {branch.statusMessage}
                  </Text>
                ) : null}
              </View>
              <OfferBadge label={shopLabel(branch)} />
            </View>
          ))}
        </Card>

        {plans.data?.length ? <DailyEssentials plans={plans.data} /> : null}

        {items.length ? (
          <ProductRail title="From this shop" products={items.slice(0, 12)} onSeeAll={() => openListing({ vendor: slug }, s.shopName)} />
        ) : products.isPending ? (
          <Loading layout="grid" />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.lg, gap: spacing.xl },
  section: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  card: { marginHorizontal: spacing.lg },
  branch: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
});
