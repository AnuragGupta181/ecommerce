"use client";

import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { riderMarkDelivered } from "./actions";

export function DeliveredButton({ token, deliveryId }: { token: string; deliveryId: string }) {
  const { pending, run } = useAction();
  return (
    <Button size="sm" pending={pending} onClick={() => run(() => riderMarkDelivered(token, deliveryId), { success: "Marked delivered" })}>
      Delivered
    </Button>
  );
}
