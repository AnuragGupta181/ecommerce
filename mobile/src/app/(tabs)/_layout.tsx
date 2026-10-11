import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";
import { Heart, House, LayoutGrid, ShoppingCart, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PillTab, pillBarStyles } from "@/components/navigation/pill-tab-bar";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot />
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
          <PillTab icon={ShoppingCart} label="Cart" />
        </TabTrigger>
        <TabTrigger name="account" href="/account" asChild>
          <PillTab icon={User} label="Account" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
