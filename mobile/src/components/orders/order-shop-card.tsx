import { router } from "expo-router";
import { FileText, LifeBuoy, MessageCircle } from "lucide-react-native";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useOpenDocument } from "@/hooks/use-documents";
import { useOpenChat } from "@/hooks/use-support";
import { errorMessage } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import type { OrderDetail } from "@/lib/types";

/** Who sold it, and the three things a customer does about an order: talk to the shop, get the invoice, report a problem. */
export function OrderShopCard({ order }: { order: OrderDetail }) {
  const openChat = useOpenChat();
  const openDocument = useOpenDocument();
  const fail = (title: string) => (error: unknown) => Alert.alert(title, errorMessage(error));
  const vendor = order.vendor;

  return (
    <Card title="Sold by">
      {vendor ? (
        <Pressable onPress={() => router.push(`/shop/${vendor.slug}`)}>
          <Text variant="h3">{vendor.shopName}</Text>
          {order.branch ? (
            <Text variant="small" color={colors.ink500}>
              {order.branch.name}
              {order.distanceKm ? ` · ${order.distanceKm} km away` : ""}
            </Text>
          ) : null}
        </Pressable>
      ) : (
        <Text>Haat</Text>
      )}
      <View style={styles.actions}>
        {vendor ? (
          <Button
            title="Message shop"
            variant="outline"
            small
            icon={<MessageCircle size={14} color={colors.ink900} />}
            loading={openChat.isPending}
            onPress={() =>
              openChat.mutate(vendor.id, {
                onSuccess: (conversation) => router.push({ pathname: "/chat/[id]", params: { id: conversation.id, orderId: order.id } }),
                onError: fail("Couldn't open chat"),
              })
            }
          />
        ) : null}
        {order.invoiceNumber ? (
          <Button
            title="Invoice"
            variant="outline"
            small
            icon={<FileText size={14} color={colors.ink900} />}
            loading={openDocument.isPending}
            onPress={() => openDocument.mutate({ kind: "invoice", id: order.id }, { onError: fail("Couldn't open the invoice") })}
          />
        ) : null}
        <Button
          title="Report a problem"
          variant="ghost"
          small
          icon={<LifeBuoy size={14} color={colors.ink900} />}
          onPress={() => router.push({ pathname: "/tickets/new", params: { orderId: order.id, category: "ORDER_ISSUE" } })}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
