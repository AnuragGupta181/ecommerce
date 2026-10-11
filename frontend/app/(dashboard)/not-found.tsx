import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardNotFound() {
  return (
    <Card>
      <EmptyState icon={SearchX} title="Not found" description="It may have been deleted or the link is wrong." action={<ButtonLink href="/">Back to dashboard</ButtonLink>} />
    </Card>
  );
}
