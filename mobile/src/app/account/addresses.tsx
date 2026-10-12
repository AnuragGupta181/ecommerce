import { router } from "expo-router";
import { MapPin, Plus } from "lucide-react-native";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { AddressLines } from "@/components/account/address-card";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { StackHeader } from "@/components/ui/stack-header";
import { EmptyState, ErrorState, Loading } from "@/components/ui/state-view";
import { Text } from "@/components/ui/text";
import { useAddresses, useDeleteAddress } from "@/hooks/use-account";
import { errorMessage } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";

export default function AddressesScreen() {
  const addresses = useAddresses();
  const remove = useDeleteAddress();

  return (
    <Screen>
      <StackHeader title="Saved addresses" />
      {addresses.isPending ? (
        <Loading />
      ) : addresses.isError ? (
        <ErrorState error={addresses.error} onRetry={() => addresses.refetch()} />
      ) : (
        <FlatList
          data={addresses.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Button title="Add a new address" variant="outline" icon={<Plus size={18} color={colors.ink900} />} onPress={() => router.push("/account/address-form")} />}
          ListEmptyComponent={<EmptyState icon={MapPin} title="No saved addresses" description="Add one to check out faster." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.tags}>
                <View style={styles.tag}>
                  <Text variant="small">{item.type}</Text>
                </View>
                {item.isDefault ? (
                  <Text variant="small" color={colors.success}>
                    Default
                  </Text>
                ) : null}
              </View>
              <AddressLines address={item} />
              <View style={styles.actions}>
                <Button title="Edit" variant="outline" small onPress={() => router.push({ pathname: "/account/address-form", params: { id: item.id } })} />
                <Button
                  title="Delete"
                  variant="danger"
                  small
                  onPress={() =>
                    Alert.alert("Delete address?", undefined, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => remove.mutate(item.id, { onError: (error) => Alert.alert("Couldn't delete", errorMessage(error)) }) },
                    ])
                  }
                />
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, gap: spacing.sm },
  tags: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tag: { backgroundColor: colors.canvas, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
