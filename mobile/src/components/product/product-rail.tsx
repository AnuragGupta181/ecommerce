import { router, type Href } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { colors, spacing } from "@/lib/theme";
import type { ProductCard as Card } from "@/lib/types";
import { ProductCard } from "./product-card";

export function ProductRail({ title, products, seeAll }: { title: string; products: Card[]; seeAll?: Href }) {
  if (products.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="h2">{title}</Text>
        {seeAll ? (
          <Pressable hitSlop={8} onPress={() => router.push(seeAll)}>
            <Text variant="small" color={colors.brand700} style={styles.link}>
              See all
            </Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard product={item} width={160} />}
        contentContainerStyle={styles.list}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  link: { fontFamily: "PlusJakartaSans_700Bold" },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
