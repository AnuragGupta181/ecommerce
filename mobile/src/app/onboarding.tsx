import { router } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { Coins, ShoppingBag, Truck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { deviceStore } from "@/lib/device-store";
import { colors, spacing } from "@/lib/theme";

const SLIDES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ShoppingBag, title: "Your local store, in your pocket", body: "Browse everything on the shelves with honest prices and real stock." },
  { icon: Truck, title: "Delivered by people you know", body: "Track your order and call your delivery partner directly." },
  { icon: Coins, title: "Earn coins on every order", body: "Get coins when your order is delivered and use them on the next one." },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await deviceStore.setOnboarded();
    router.replace("/");
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <Pressable accessibilityRole="button" hitSlop={12} onPress={finish} style={styles.skip}>
        <Text color={colors.ink500}>Skip</Text>
      </Pressable>
      <View style={styles.center}>
        <View style={styles.badge}>
          <slide.icon size={56} color={colors.ink900} strokeWidth={1.5} />
        </View>
        <Text variant="display" style={styles.text}>
          {slide.title}
        </Text>
        <Text color={colors.ink700} style={styles.text}>
          {slide.body}
        </Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button title={last ? "Start shopping" : "Next"} onPress={() => (last ? finish() : setIndex(index + 1))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skip: { alignSelf: "flex-end", padding: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xxl },
  badge: { width: 140, height: 140, borderRadius: 70, backgroundColor: colors.brand500, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  text: { textAlign: "center" },
  footer: { padding: spacing.lg, gap: spacing.xl },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink300 },
  dotActive: { width: 18, backgroundColor: colors.ink900 },
});
