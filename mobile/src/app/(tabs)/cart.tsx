import { router } from "expo-router";
import { ShoppingCart } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartShopHeader } from "@/components/cart/cart-shop-header";
import { CouponSheet } from "@/components/cart/coupon-sheet";
import { PayBar } from "@/components/cart/pay-bar";
import { PriceDetails } from "@/components/cart/price-details";
import { SavingsOptions } from "@/components/cart/savings-options";
import { TAB_BAR_CLEARANCE } from "@/components/navigation/pill-tab-bar";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useCart } from "@/hooks/use-cart";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { colors, spacing } from "@/lib/theme";

export default function CartScreen() {
  const { isLoggedIn, guard } = useRequireAuth();
  const insets = useSafeAreaInsets();
  const [coupon, setCoupon] = useState<string>();
  const [useCoins, setUseCoins] = useState(false);
  const [couponsOpen, setCouponsOpen] = useState(false);
  const cart = useCart({ coupon, useCoins });

  const items = cart.data?.items ?? [];
  const blocked = items.some((line) => !line.available) || cart.data?.deliverable === false;

  return (
    <Screen backdrop="cart" tab>
      <View style={styles.header}>
        <Text variant="h1">My cart</Text>
        {items.length ? (
          <Text variant="small" color={colors.ink500}>
            {cart.data?.summary.itemCount} items
          </Text>
        ) : null}
      </View>
      {!isLoggedIn ? (
        <EmptyState icon={ShoppingCart} title="Your cart is waiting" description="Login to add items and check out." actionLabel="Login" onAction={() => guard(() => undefined, "Login to see your cart")} />
      ) : cart.isPending ? (
        <Loading />
      ) : cart.isError ? (
        <ErrorState error={cart.error} onRetry={() => cart.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Your cart is empty" description="Add items you like and they will show up here." actionLabel="Start shopping" onAction={() => router.push("/")} />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={cart.isRefetching} onRefresh={() => cart.refetch()} tintColor={colors.brand600} />}
          >
            {cart.data.shop ? <CartShopHeader shop={cart.data.shop} deliverable={cart.data.deliverable} /> : null}
            {items.map((line) => (
              <CartLineItem key={line.id} line={line} />
            ))}
            <SavingsOptions
              summary={cart.data.summary}
              coupon={coupon}
              useCoins={useCoins}
              onOpenCoupons={() => setCouponsOpen(true)}
              onClearCoupon={() => setCoupon(undefined)}
              onToggleCoins={setUseCoins}
            />
            <PriceDetails summary={cart.data.summary} />
          </ScrollView>
          <PayBar
            payable={cart.data.summary.payable}
            savings={cart.data.summary.totalSavings}
            label={cart.data.deliverable === false ? "Shop can't deliver now" : blocked ? "Remove unavailable items" : "Place order"}
            disabled={blocked}
            bottomOffset={TAB_BAR_CLEARANCE - spacing.xl + insets.bottom}
            onPress={() =>
              router.push({
                pathname: "/checkout",
                params: { coupon: coupon && !cart.data.summary.couponError ? coupon : "", useCoins: useCoins ? "1" : "" },
              })
            }
          />
        </>
      )}
      <CouponSheet visible={couponsOpen} onClose={() => setCouponsOpen(false)} onApply={setCoupon} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", padding: spacing.lg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
});
