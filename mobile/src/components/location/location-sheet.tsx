import { Crosshair, MapPin } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionRow } from "@/components/ui/option-row";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useDeliveryLocation, useDetectLocation, useSetLocation } from "@/hooks/use-location";
import { errorMessage } from "@/lib/api";
import { parseLatLng, PRESET_AREAS, presetByPincode } from "@/lib/geo";
import { colors, spacing } from "@/lib/theme";

/** Detect with GPS, pick an area, or type a pincode / "lat, lng". Every choice re-prices the app. */
export function LocationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const current = useDeliveryLocation();
  const detect = useDetectLocation();
  const setLocation = useSetLocation();
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string>();

  const applyManual = async () => {
    const text = manual.trim();
    const preset = /^\d{6}$/.test(text) ? presetByPincode(text) : undefined;
    const point = preset ?? parseLatLng(text);
    if (!point) {
      setManualError(/^\d{6}$/.test(text) ? "We don't deliver to that pincode yet. Pick an area below." : "Enter a 6-digit pincode or a location like 12.97, 77.59");
      return;
    }
    await setLocation({ lat: point.lat, lng: point.lng, label: preset ? `${preset.name} ${preset.pincode}` : "Pinned location", source: "manual" });
    setManual("");
    setManualError(undefined);
    onClose();
  };

  return (
    <Sheet visible={visible} title="Where should we deliver?" onClose={onClose}>
      <Button
        title={detect.isPending ? "Finding you…" : "Use my current location"}
        icon={<Crosshair size={18} color={colors.ink900} />}
        loading={detect.isPending}
        onPress={() => detect.mutate(undefined, { onSuccess: onClose })}
      />
      {detect.isError ? (
        <Text variant="small" color={colors.danger}>
          {errorMessage(detect.error)}
        </Text>
      ) : null}
      <View style={styles.manual}>
        <View style={styles.flex}>
          <Input placeholder="Pincode or 12.97, 77.59" value={manual} onChangeText={setManual} error={manualError} onSubmitEditing={applyManual} returnKeyType="done" />
        </View>
        <Button title="Set" variant="outline" onPress={applyManual} style={styles.set} />
      </View>
      <Text variant="small" color={colors.ink500}>
        Areas we serve
      </Text>
      {PRESET_AREAS.map((area) => (
        <OptionRow
          key={area.name}
          label={area.name}
          description={`Bengaluru ${area.pincode}`}
          selected={current?.lat === area.lat && current?.lng === area.lng}
          onPress={async () => {
            await setLocation({ lat: area.lat, lng: area.lng, label: `${area.name} ${area.pincode}`, source: "manual" });
            onClose();
          }}
          right={<MapPin size={16} color={colors.ink500} />}
        />
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  manual: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  flex: { flex: 1 },
  set: { height: 48 },
});
