import { router, useLocalSearchParams } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { formatINR } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";

export default function OrderSuccessScreen() {
  const { id, orderNumber, payable, coins } = useLocalSearchParams<{ id: string; orderNumber: string; payable: string; coins: string }>();

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={styles.center}>
        <View style={styles.badge}>
          <CircleCheck size={44} color={colors.success} strokeWidth={1.75} />
        </View>
        <Text variant="display" style={styles.text}>
          Order placed
        </Text>
        <Text color={colors.ink700} style={styles.text}>
          Order {orderNumber} · {formatINR(Number(payable) || 0)} to pay on delivery
        </Text>
        {Number(coins) > 0 ? (
          <Text color={colors.brand700} style={styles.text}>
            You’ll earn {coins} coins once it’s delivered.
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button title="Track order" onPress={() => router.replace(`/orders/${id}`)} />
        <Button title="Continue shopping" variant="outline" onPress={() => router.dismissTo("/")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  badge: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center" },
  text: { textAlign: "center" },
  actions: { padding: spacing.lg, gap: spacing.md },
});
