import { StyleSheet, View } from "react-native";
import { RatingChip } from "@/components/ui/rating-chip";
import { Text } from "@/components/ui/text";
import { formatDate } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";
import type { ProductDetail, ReviewItem } from "@/lib/types";

export function RatingSummary({ rating }: { rating: ProductDetail["rating"] }) {
  const max = Math.max(1, ...Object.values(rating.breakdown));
  return (
    <View style={styles.summary}>
      <View style={styles.average}>
        <Text variant="display">{rating.average.toFixed(1)}</Text>
        <Text variant="small" color={colors.ink500}>
          {rating.count} ratings
        </Text>
      </View>
      <View style={styles.bars}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = rating.breakdown[String(star)] ?? 0;
          return (
            <View key={star} style={styles.barRow}>
              <Text variant="small" style={styles.star}>
                {star}★
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(count / max) * 100}%`, backgroundColor: star >= 3 ? colors.success : colors.danger }]} />
              </View>
              <Text variant="small" color={colors.ink500} style={styles.count}>
                {count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ReviewRow({ review }: { review: ReviewItem }) {
  return (
    <View style={styles.review}>
      <View style={styles.reviewHead}>
        <RatingChip rating={review.rating} />
        {review.title ? <Text variant="h3">{review.title}</Text> : null}
      </View>
      {review.comment ? <Text color={colors.ink700}>{review.comment}</Text> : null}
      <Text variant="small" color={colors.ink500}>
        {review.userName} · {formatDate(review.createdAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", gap: spacing.xl, alignItems: "center" },
  average: { alignItems: "center" },
  bars: { flex: 1, gap: 4 },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  star: { width: 24 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  count: { width: 28, textAlign: "right" },
  review: { gap: 4, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
