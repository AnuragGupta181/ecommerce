import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { colors } from "@/lib/theme";
import type { OrderStatus } from "@/lib/types";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  RIDER_ASSIGNED: "Rider assigned",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  RETURN_REJECTED: "Return rejected",
};

function tone(status: OrderStatus): { bg: string; fg: string } {
  if (status === "DELIVERED" || status === "RETURNED") return { bg: colors.successSoft, fg: colors.success };
  if (status === "CANCELLED" || status === "RETURN_REJECTED") return { bg: colors.dangerSoft, fg: colors.danger };
  return { bg: colors.brand100, fg: colors.ink900 };
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { bg, fg } = tone(status);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text variant="small" color={fg} style={styles.bold}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  bold: { fontFamily: "PlusJakartaSans_700Bold" },
});
