import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddAdminButton } from "@/components/admins/add-admin-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { AdminAccount } from "@/lib/marketplace-types";
import { api } from "@/lib/server/api";
import { isSuperAdmin } from "@/lib/server/session";
import { removeAdmin, restoreAdmin } from "./actions";

export const metadata: Metadata = { title: "Admins" };

export default function AdminsPage() {
  return (
    <>
      <PageHeader title="Admins" description="Only the super admin can add or remove admin accounts." actions={<AddAdminButton />} />
      <Suspense fallback={<TableSkeleton />}>
        <AdminsTable />
      </Suspense>
    </>
  );
}

async function AdminsTable() {
  if (!(await isSuperAdmin())) redirect("/");
  const admins = await api.get<AdminAccount[]>("/admin/admins");

  return (
    <Card>
      <Table minWidth={640}>
        <THead>
          <Th>Admin</Th>
          <Th>Since</Th>
          <Th>Role</Th>
          <Th />
        </THead>
        <tbody>
          {admins.map((admin) => (
            <Tr key={admin.id}>
              <Td>
                <p className="font-semibold">{admin.name}</p>
                <p className="text-xs text-ink-500">
                  {admin.email}
                  {admin.phone ? ` · ${admin.phone}` : ""}
                </p>
              </Td>
              <Td>{formatDate(admin.createdAt)}</Td>
              <Td>
                {admin.isSuperAdmin ? <Badge tone="brand">Super admin</Badge> : admin.isBlocked ? <Badge tone="danger">Removed</Badge> : <Badge>Admin</Badge>}
              </Td>
              <Td align="right">
                {admin.isSuperAdmin ? null : admin.isBlocked ? (
                  <ConfirmAction
                    label="Restore"
                    variant="outline"
                    title={`Restore ${admin.name}?`}
                    description="Their login works again."
                    confirmLabel="Restore"
                    success="Admin restored"
                    action={restoreAdmin.bind(null, admin.id)}
                  />
                ) : (
                  <ConfirmAction
                    label="Remove"
                    title={`Remove ${admin.name}?`}
                    description="Their login stops working at once. Their past actions stay in the audit log."
                    confirmLabel="Remove"
                    success="Admin removed"
                    action={removeAdmin.bind(null, admin.id)}
                  />
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
