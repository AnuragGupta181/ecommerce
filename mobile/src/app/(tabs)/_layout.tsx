import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";
import { Heart, House, LayoutGrid, ShoppingCart, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PillTab, pillBarStyles } from "@/components/navigation/pill-tab-bar";
import { useCartCount } from "@/hooks/use-cart";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();

  return (
    <Tabs>
      {/* The slot's default flexShrink: 0 lets a tab grow to its content height on web, so nothing scrolls. */}
      <TabSlot style={{ flexShrink: 1, minHeight: 0 }} />
      <TabList style={[pillBarStyles.bar, { bottom: insets.bottom + 16 }]}>
        <TabTrigger name="index" href="/" asChild>
          <PillTab icon={House} label="Home" />
        </TabTrigger>
        <TabTrigger name="categories" href="/categories" asChild>
          <PillTab icon={LayoutGrid} label="Categories" />
        </TabTrigger>
        <TabTrigger name="wishlist" href="/wishlist" asChild>
          <PillTab icon={Heart} label="Wishlist" />
        </TabTrigger>
        <TabTrigger name="cart" href="/cart" asChild>
          <PillTab icon={ShoppingCart} label="Cart" badge={cartCount.data} />
        </TabTrigger>
        <TabTrigger name="account" href="/account" asChild>
          <PillTab icon={User} label="Account" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
