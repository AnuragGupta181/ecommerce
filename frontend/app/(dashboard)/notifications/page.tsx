import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Notification log" };

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notification log" description="Email and WhatsApp delivery log" />
      <Card>
        <EmptyState icon={Bell} title="Notification log is being built" description="This section is scaffolded; its data views land in the next step of docs/PLAN.md." />
      </Card>
    </>
  );
}
