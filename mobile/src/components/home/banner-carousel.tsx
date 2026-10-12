import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "@/components/ui/text";
import { openBanner } from "@/lib/navigation";
import { colors, radius, spacing } from "@/lib/theme";
import type { Banner } from "@/lib/types";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const itemWidth = width - spacing.lg * 2;
  if (banners.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        pagingEnabled={false}
        snapToInterval={itemWidth + spacing.md}
        decelerationRate="fast"
        data={banners}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / (itemWidth + spacing.md)))}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => openBanner(item)} style={[styles.banner, { width: itemWidth }]}>
            <Image source={item.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            <View style={styles.caption}>
              <Text variant="h3" numberOfLines={1}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text variant="small" color={colors.ink700} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
      {banners.length > 1 ? (
        <View style={styles.dots}>
          {banners.map((banner, i) => (
            <View key={banner.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  banner: { height: 170, borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.brand100, justifyContent: "flex-end" },
  // Solid surface caption keeps text legible over any photo (no gradients per DESIGN.md).
  caption: { margin: spacing.md, alignSelf: "flex-start", maxWidth: "85%", backgroundColor: colors.surface, borderRadius: radius.control, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink300 },
  dotActive: { width: 18, backgroundColor: colors.ink900 },
});
