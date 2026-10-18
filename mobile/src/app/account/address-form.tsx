import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { Text } from "@/components/ui/text";
import { useAddresses, useSaveAddress } from "@/hooks/use-account";
import { detectCurrentPlace } from "@/hooks/use-location";
import { errorMessage, fieldErrors } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useLocationStore } from "@/lib/location-store";
import { colors, spacing } from "@/lib/theme";
import type { AddressInput } from "@/lib/types";

const TYPES: AddressInput["type"][] = ["HOME", "WORK", "OTHER"];

export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const user = useAuthStore((state) => state.user);
  const existing = useAddresses().data?.find((address) => address.id === id);
  const save = useSaveAddress();
  // A new address starts at the shopper's chosen delivery point; GPS can refine it.
  const deliveryPoint = useLocationStore((state) => state.location);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState<AddressInput>(() => ({
    name: existing?.name ?? user?.name ?? "",
    phone: existing?.phone ?? user?.phone ?? "",
    line1: existing?.line1 ?? "",
    line2: existing?.line2 ?? "",
    landmark: existing?.landmark ?? "",
    city: existing?.city ?? "",
    state: existing?.state ?? "",
    pincode: existing?.pincode ?? "",
    type: existing?.type ?? "HOME",
    isDefault: existing?.isDefault ?? false,
    lat: existing?.lat ?? deliveryPoint?.lat ?? null,
    lng: existing?.lng ?? deliveryPoint?.lng ?? null,
  }));

  /** The pin decides distance and delivery fee, so it matters more than the typed text. */
  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const place = await detectCurrentPlace();
      setForm((current) => ({
        ...current,
        lat: place.lat,
        lng: place.lng,
        line1: current.line1 || place.street || "",
        line2: current.line2 || place.area || "",
        city: current.city || place.city || "",
        state: current.state || place.state || "",
        pincode: current.pincode || place.pincode || "",
      }));
    } catch (error) {
      Alert.alert("Couldn't get your location", errorMessage(error));
    } finally {
      setLocating(false);
    }
  };
  const errors = fieldErrors(save.error);
  const set = <K extends keyof AddressInput>(key: K) => (value: AddressInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const input = { ...form, line2: form.line2?.trim() || null, landmark: form.landmark?.trim() || null };
    save.mutate(
      { id, input },
      { onSuccess: () => router.back(), onError: (error) => Object.keys(fieldErrors(error)).length || Alert.alert("Couldn't save address", errorMessage(error)) },
    );
  };

  return (
    <Screen backdrop="account">
      <StackHeader title={id ? "Edit address" : "Add address"} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Button title={form.lat != null ? "Update pin to my current location" : "Use my current location"} variant="outline" loading={locating} onPress={useCurrentLocation} />
          <Text variant="small" color={colors.ink500}>
            {form.lat != null && form.lng != null ? `Delivery pin: ${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : "No delivery pin yet. Shops use it to work out distance and delivery charge."}
          </Text>
          <Input label="Full name" value={form.name} onChangeText={set("name")} error={errors.name} />
          <Input label="Phone" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} />
          <Input label="House no., building, street" value={form.line1} onChangeText={set("line1")} error={errors.line1} />
          <Input label="Area, colony (optional)" value={form.line2 ?? ""} onChangeText={set("line2")} error={errors.line2} />
          <Input label="Landmark (optional)" value={form.landmark ?? ""} onChangeText={set("landmark")} error={errors.landmark} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Input label="City" value={form.city} onChangeText={set("city")} error={errors.city} />
            </View>
            <View style={styles.flex}>
              <Input label="Pincode" value={form.pincode} onChangeText={set("pincode")} keyboardType="number-pad" maxLength={6} error={errors.pincode} />
            </View>
          </View>
          <Input label="State" value={form.state} onChangeText={set("state")} error={errors.state} />
          <Text variant="small" color={colors.ink700}>
            Address type
          </Text>
          <View style={styles.chips}>
            {TYPES.map((type) => (
              <Chip key={type} label={type.charAt(0) + type.slice(1).toLowerCase()} selected={form.type === type} onPress={() => set("type")(type)} />
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text variant="h3">Make this my default address</Text>
            <Switch value={form.isDefault} onValueChange={set("isDefault")} trackColor={{ true: colors.brand500, false: colors.line }} thumbColor={colors.surface} />
          </View>
          <Button title="Save address" loading={save.isPending} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  chips: { flexDirection: "row", gap: spacing.sm },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
});
