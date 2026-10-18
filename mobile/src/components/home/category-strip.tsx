import { Image } from "expo-image";
import { LayoutGrid } from "lucide-react-native";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { openListing } from "@/lib/navigation";
import { colors, spacing } from "@/lib/theme";
import type { CategoryNode } from "@/lib/types";

export function CategoryStrip({ categories }: { categories: CategoryNode[] }) {
  if (categories.length === 0) return null;
  return (
    <FlatList
      horizontal
      data={categories}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <CategoryBubble category={item} />}
    />
  );
}

export function CategoryBubble({ category, size = 64 }: { category: CategoryNode; size?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={category.name} onPress={() => openListing({ category: category.slug }, category.name)} style={[styles.item, { width: size + 12 }]}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        {category.imageUrl ? <Image transition={200} source={category.imageUrl} style={styles.image} contentFit="cover" /> : <LayoutGrid size={22} color={colors.ink700} />}
      </View>
      <Text variant="small" numberOfLines={2} style={styles.label}>
        {category.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  item: { alignItems: "center", gap: 6 },
  circle: { backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  label: { textAlign: "center" },
});
