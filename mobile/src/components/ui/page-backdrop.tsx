import { Image, type ImageSource } from "expo-image";
import { StyleSheet, View } from "react-native";
import { TAB_BAR_CLEARANCE } from "@/components/navigation/pill-tab-bar";

/** Bundled grocery photos (transparent webp), so backdrops never wait on a CDN. */
const photo = {
  cucumber: require("../../../assets/backdrop/cucumber.webp"),
  eggs: require("../../../assets/backdrop/eggs.webp"),
  greenPepper: require("../../../assets/backdrop/green-bell-pepper.webp"),
  honey: require("../../../assets/backdrop/honey-jar.webp"),
  iceCream: require("../../../assets/backdrop/ice-cream.webp"),
  juice: require("../../../assets/backdrop/juice.webp"),
  kiwi: require("../../../assets/backdrop/kiwi.webp"),
  lemon: require("../../../assets/backdrop/lemon.webp"),
  milk: require("../../../assets/backdrop/milk.webp"),
  mulberry: require("../../../assets/backdrop/mulberry.webp"),
  coffee: require("../../../assets/backdrop/nescafe-coffee.webp"),
  potatoes: require("../../../assets/backdrop/potatoes.webp"),
  onions: require("../../../assets/backdrop/red-onions.webp"),
  rice: require("../../../assets/backdrop/rice.webp"),
  strawberry: require("../../../assets/backdrop/strawberry.webp"),
  water: require("../../../assets/backdrop/water.webp"),
} satisfies Record<string, ImageSource>;

/** One pair per kind of page: a large item low on the right, a smaller one higher on the left. */
const THEMES = {
  /** Cart and checkout: a basket's worth of everyday buys. */
  cart: [photo.juice, photo.eggs],
  /** Wishlist: things people treat themselves to. */
  wishlist: [photo.strawberry, photo.iceCream],
  /** Orders: staples that arrive at the door. */
  orders: [photo.rice, photo.potatoes],
  /** Subscriptions and plans: the daily milk run. */
  subscriptions: [photo.milk, photo.eggs],
  /** Categories and browsing: fresh produce. */
  browse: [photo.greenPepper, photo.onions],
  /** Account, profile, addresses, coins. */
  account: [photo.coffee, photo.water],
  /** Help: tickets and chat. */
  support: [photo.lemon, photo.kiwi],
  /** Offers and notifications. */
  offers: [photo.honey, photo.mulberry],
  /** Products and shops. */
  shop: [photo.cucumber, photo.strawberry],
} as const;

export type BackdropTheme = keyof typeof THEMES;

/** Faint, decorative and behind everything; never takes touches or screen-reader focus. */
export function PageBackdrop({ theme, aboveTabBar }: { theme: BackdropTheme; aboveTabBar?: boolean }) {
  const [large, small] = THEMES[theme];
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Image source={large} contentFit="contain" style={[styles.large, { bottom: aboveTabBar ? TAB_BAR_CLEARANCE - 40 : -30 }]} />
      <Image source={small} contentFit="contain" style={styles.small} />
    </View>
  );
}

const styles = StyleSheet.create({
  large: { position: "absolute", right: -50, width: 230, height: 230, opacity: 0.14, transform: [{ rotate: "-12deg" }] },
  small: { position: "absolute", left: -40, top: "38%", width: 140, height: 140, opacity: 0.1, transform: [{ rotate: "14deg" }] },
});
