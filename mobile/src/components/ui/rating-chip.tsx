import { Star } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { colors } from "@/lib/theme";
import { Text } from "./text";

export function RatingChip({ rating, count }: { rating: number; count?: number }) {
  if (!rating) return null;
  return (
    <View style={styles.row}>
      <View style={[styles.chip, { backgroundColor: rating >= 3 ? colors.success : colors.danger }]}>
        <Text variant="small" color={colors.surface} style={styles.bold}>
          {rating.toFixed(1)}
        </Text>
        <Star size={10} color={colors.surface} fill={colors.surface} />
      </View>
      {count !== undefined ? (
        <Text variant="small" color={colors.ink500}>
          ({count})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
});
