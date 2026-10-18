import { ChevronDown, MapPin } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useDeliveryLocation } from "@/hooks/use-location";
import { colors, radius, spacing } from "@/lib/theme";
import { LocationSheet } from "./location-sheet";

/** "Delivering to Hebbal 560024 ▾": prices, shops and fees all follow this choice. */
export function LocationBar() {
  const location = useDeliveryLocation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Change delivery location" onPress={() => setOpen(true)} style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
        <MapPin size={16} color={colors.ink900} />
        <View style={styles.text}>
          <Text variant="small" color={colors.ink500}>
            Delivering to
          </Text>
          <Text variant="h3" numberOfLines={1}>
            {location?.label ?? "Choose your location"}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.ink700} />
      </Pressable>
      <LocationSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.control, backgroundColor: colors.brand100 },
  pressed: { opacity: 0.85 },
  text: { flex: 1 },
});
