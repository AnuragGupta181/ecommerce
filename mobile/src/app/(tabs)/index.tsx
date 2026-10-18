import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { BannerCarousel } from "@/components/home/banner-carousel";
import { CategoryStrip } from "@/components/home/category-strip";
import { DailyEssentials } from "@/components/home/daily-essentials";
import { NearbyShops } from "@/components/home/nearby-shops";
import { LocationBar } from "@/components/location/location-bar";
import { TAB_BAR_CLEARANCE } from "@/components/navigation/pill-tab-bar";
import { ProductRail } from "@/components/product/product-rail";
import { Screen } from "@/components/ui/screen";
import { SearchBar } from "@/components/ui/search-bar";
import { ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useUnreadCount } from "@/hooks/use-account";
import { useHome } from "@/hooks/use-catalog";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useAuthStore } from "@/lib/auth-store";
import { openBanner, openListing } from "@/lib/navigation";
import { colors, radius, spacing } from "@/lib/theme";

export default function HomeScreen() {
  const home = useHome();
  const name = useAuthStore((state) => state.user?.name.split(" ")[0]);
  const unread = useUnreadCount();
  const { guard } = useRequireAuth();

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.greeting}>
          <Text variant="h1">Haat</Text>
          <Text variant="small" color={colors.ink500}>
            {name ? `Hello, ${name}` : "Your neighbourhood store"}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8} onPress={() => guard(() => router.push("/account/notifications"), "Login to see your notifications")} style={styles.bell}>
          <Bell size={22} color={colors.ink900} />
          {unread.data ? <View style={styles.unread} /> : null}
        </Pressable>
      </View>
      <View style={styles.search}>
        <LocationBar />
        <SearchBar />
      </View>
      {home.isPending ? (
        <Loading layout="home" />
      ) : home.isError ? (
        <ErrorState error={home.error} onRetry={() => home.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => home.refetch()} tintColor={colors.brand600} />}
        >
          <CategoryStrip categories={home.data.categories} />
          <BannerCarousel banners={home.data.banners.carousel} />
          <DailyEssentials plans={home.data.dailyEssentials ?? []} />
          <NearbyShops shops={home.data.shops ?? []} />
          {home.data.rails.map((rail, i) => (
            <View key={rail.key} style={styles.section}>
              <ProductRail title={rail.title} products={rail.items} onSeeAll={() => openListing(rail.query, rail.title)} />
              {home.data.banners.strip[i] ? (
                <Pressable accessibilityRole="button" onPress={() => openBanner(home.data.banners.strip[i])} style={styles.strip}>
                  <Text variant="h3">{home.data.banners.strip[i].title}</Text>
                  {home.data.banners.strip[i].subtitle ? (
                    <Text variant="small" color={colors.ink700}>
                      {home.data.banners.strip[i].subtitle}
                    </Text>
                  ) : null}
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  greeting: { flex: 1 },
  bell: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  unread: { position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  search: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  content: { gap: spacing.xxl, paddingBottom: TAB_BAR_CLEARANCE },
  section: { gap: spacing.xxl },
  strip: { marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.card, backgroundColor: colors.brand100, gap: 2 },
});
