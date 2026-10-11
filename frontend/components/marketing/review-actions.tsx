"use client";

import { Eye, EyeOff } from "lucide-react";
import { deleteReview, setReviewHidden } from "@/app/(dashboard)/marketing-actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { useAction } from "@/lib/use-action";

export function ReviewActions({ id, isHidden }: { id: string; isHidden: boolean }) {
  const { pending, run } = useAction();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" pending={pending} onClick={() => run(() => setReviewHidden(id, !isHidden), { success: isHidden ? "Review shown" : "Review hidden" })}>
        {isHidden ? <Eye size={14} /> : <EyeOff size={14} />} {isHidden ? "Show" : "Hide"}
      </Button>
      <ConfirmAction label="Delete" title="Delete review?" description="The product rating is recalculated. This cannot be undone." confirmLabel="Delete" success="Review deleted" action={() => deleteReview(id)} />
    </div>
  );
}
