import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { colors, spacing } from "@/lib/theme";
import type { ProductDetail } from "@/lib/types";

export function Gallery({ images }: { images: ProductDetail["images"] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        pagingEnabled
        data={images}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <Image source={item.url} accessibilityLabel={item.alt ?? undefined} style={{ width, height: width * 0.9 }} contentFit="contain" transition={150} />}
      />
      {images.length > 1 ? (
        <View style={styles.dots}>
          {images.map((image, i) => (
            <View key={image.id} style={[styles.dot, i === index && styles.active]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, paddingBottom: spacing.md },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink300 },
  active: { width: 18, backgroundColor: colors.ink900 },
});
