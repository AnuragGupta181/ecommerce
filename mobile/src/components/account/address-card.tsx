import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { colors } from "@/lib/theme";
import type { Address } from "@/lib/types";

export function AddressLines({ address }: { address: Omit<Address, "id" | "type" | "isDefault"> }) {
  return (
    <View style={styles.lines}>
      <Text variant="h3">
        {address.name} · {address.phone}
      </Text>
      <Text color={colors.ink700}>{[address.line1, address.line2, address.landmark].filter(Boolean).join(", ")}</Text>
      <Text color={colors.ink700}>
        {address.city}, {address.state} {address.pincode}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: 2, flex: 1 },
});
