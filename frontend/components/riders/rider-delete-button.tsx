"use client";

import { useRouter } from "next/navigation";
import { deleteRider } from "@/app/(dashboard)/riders/actions";
import { ConfirmAction } from "@/components/ui/confirm-action";

export function RiderDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      label="Delete"
      title="Delete rider?"
      description="Riders with delivery history are deactivated instead of deleted."
      confirmLabel="Delete"
      success="Rider removed"
      action={() => deleteRider(id)}
      onDone={() => router.push("/riders")}
    />
  );
}
