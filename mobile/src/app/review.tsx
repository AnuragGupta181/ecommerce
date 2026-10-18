import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Star } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Text } from "@/components/ui/text";
import { useSubmitReview } from "@/hooks/use-orders";
import { errorMessage, fieldErrors } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";

const LABELS = ["", "Very bad", "Bad", "Good", "Very good", "Excellent"];

export default function WriteReviewScreen() {
  const { productId, name, imageUrl } = useLocalSearchParams<{ productId: string; name: string; imageUrl?: string }>();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const submit = useSubmitReview();
  const errors = fieldErrors(submit.error);

  return (
    <Screen>
      <StackHeader title="Rate product" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.product}>
          {imageUrl ? <Image transition={200} source={imageUrl} style={styles.thumb} contentFit="contain" /> : null}
          <Text variant="h3" numberOfLines={2} style={styles.flex}>
            {name}
          </Text>
        </View>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable key={value} accessibilityLabel={`${value} star${value > 1 ? "s" : ""}`} hitSlop={6} onPress={() => setRating(value)}>
              <Star size={36} color={value <= rating ? colors.brand600 : colors.ink300} fill={value <= rating ? colors.brand500 : "transparent"} />
            </Pressable>
          ))}
        </View>
        <Text color={colors.ink700} style={styles.center}>
          {LABELS[rating] || "Tap a star to rate"}
        </Text>
        <Input label="Title (optional)" value={title} onChangeText={setTitle} maxLength={100} error={errors.title} />
        <Input label="Your review (optional)" value={comment} onChangeText={setComment} multiline maxLength={2000} style={styles.comment} error={errors.comment} />
        <Button
          title="Submit review"
          loading={submit.isPending}
          disabled={!rating}
          onPress={() =>
            submit.mutate(
              { productId, rating, title: title.trim() || undefined, comment: comment.trim() || undefined },
              {
                onSuccess: () => Alert.alert("Thanks for your review", undefined, [{ text: "OK", onPress: () => router.back() }]),
                onError: (error) => Object.keys(fieldErrors(error)).length || Alert.alert("Couldn't submit review", errorMessage(error)),
              },
            )
          }
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  product: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line },
  thumb: { width: 56, height: 56, borderRadius: radius.control },
  flex: { flex: 1 },
  stars: { flexDirection: "row", justifyContent: "center", gap: spacing.md },
  center: { textAlign: "center" },
  comment: { minHeight: 120, textAlignVertical: "top", paddingTop: 12 },
});
