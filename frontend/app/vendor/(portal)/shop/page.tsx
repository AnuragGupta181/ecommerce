import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { AddStaffButton, BranchFormButton, BranchOnlineSwitch, ShopProfileForm } from "@/components/vendor/shop-forms";
import { formatINR, titleCase } from "@/lib/format";
import type { Branch, Vendor, VendorMember } from "@/lib/marketplace-types";
import { api } from "@/lib/server/api";
import { getPortalProfile } from "@/lib/server/session";
import { removeStaff } from "./actions";

export const metadata: Metadata = { title: "Shop settings" };

export default function ShopSettingsPage() {
  return (
    <>
      <PageHeader title="Shop settings" description="Your details, branches, hours and delivery charges." />
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const profile = await getPortalProfile();
  const isOwner = profile.vendorRole === "OWNER";
  const [vendor, branches, staff] = await Promise.all([
    api.get<Vendor>("/vendor/profile"),
    api.get<Branch[]>("/vendor/branches"),
    isOwner ? api.get<VendorMember[]>("/vendor/staff") : Promise.resolve([] as VendorMember[]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-ink-700">
        <Badge tone={vendor.status === "APPROVED" ? "success" : vendor.status === "PENDING" ? "warning" : "danger"}>{titleCase(vendor.status)}</Badge>
        <span>
          Commission {vendor.commissionBps / 100}% on goods · shop page <span className="font-mono text-xs">/{vendor.slug}</span>
        </span>
      </div>

      <ShopProfileForm vendor={vendor} canEdit={isOwner} />

      <Card title="Branches" actions={isOwner ? <BranchFormButton branch={null} /> : undefined}>
        <Table minWidth={900}>
          <THead>
            <Th>Branch</Th>
            <Th>Hours</Th>
            <Th>Delivery</Th>
            <Th>Orders</Th>
            <Th>Online</Th>
            <Th />
          </THead>
          <tbody>
            {branches.map((branch) => (
              <Tr key={branch.id}>
                <Td>
                  <p className="font-semibold">{branch.name}</p>
                  <p className="text-xs text-ink-500">
                    {branch.address}, {branch.city}
                  </p>
                  <p className="text-xs text-ink-500">{branch.isOpen ? "Open now" : (branch.statusMessage ?? "Closed now")}</p>
                </Td>
                <Td>{branch.opensAt && branch.closesAt ? `${branch.opensAt} – ${branch.closesAt}` : "Always open"}</Td>
                <Td className="text-xs">
                  Up to {branch.deliveryRadiusKm} km · {formatINR(branch.deliveryRatePerKm)}/km, min {formatINR(branch.minDeliveryFee)}
                  {branch.freeDeliveryAbove != null ? ` · free above ${formatINR(branch.freeDeliveryAbove)}` : ""}
                </Td>
                <Td className="text-xs">
                  {branch.listingCount} items · {branch.orderCount} orders
                </Td>
                <Td>
                  <BranchOnlineSwitch branch={branch} />
                </Td>
                <Td align="right">{isOwner ? <BranchFormButton branch={branch} /> : null}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {isOwner ? (
        <Card title="Staff logins" actions={<AddStaffButton />}>
          <Table minWidth={560}>
            <THead>
              <Th>Name</Th>
              <Th>Login</Th>
              <Th>Role</Th>
              <Th />
            </THead>
            <tbody>
              {staff.map((member) => (
                <Tr key={member.id}>
                  <Td className="font-semibold">{member.name}</Td>
                  <Td>
                    <p>{member.email}</p>
                    <p className="text-xs text-ink-500">{member.phone}</p>
                  </Td>
                  <Td>{member.vendorRole === "OWNER" ? "Owner" : "Staff"}</Td>
                  <Td align="right">
                    {member.vendorRole === "STAFF" ? (
                      <ConfirmAction
                        label="Remove"
                        title={`Remove ${member.name}?`}
                        description="Their login stops working immediately."
                        confirmLabel="Remove"
                        success="Staff login removed"
                        action={removeStaff.bind(null, member.id)}
                      />
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
