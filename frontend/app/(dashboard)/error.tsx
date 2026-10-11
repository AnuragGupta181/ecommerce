"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={TriangleAlert}
        title="This page could not load"
        description="The store server may be unreachable. Check that the API is running, then try again."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
