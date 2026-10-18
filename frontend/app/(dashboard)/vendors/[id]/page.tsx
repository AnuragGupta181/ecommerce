import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { VendorStatusButtons, VendorTermsCard } from "@/components/vendors/vendor-controls";
import { formatCount, formatDate, formatINR, titleCase } from "@/lib/format";
import type { AdminVendorDetail } from "@/lib/marketplace-types";
import { ApiError, api } from "@/lib/server/api";
import { vendorStatusTone } from "@/lib/status-tones";

export const metadata: Metadata = { title: "Vendor" };

export default function VendorPage({ params }: PageProps<"/vendors/[id]">) {
  return (
    <>
      <Link href="/vendors" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Vendors
      </Link>
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <VendorContent params={params} />
      </Suspense>
    </>
  );
}

async function VendorContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = await api.get<AdminVendorDetail>(`/admin/vendors/${id}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold">{vendor.shopName}</h1>
        <Badge tone={vendorStatusTone[vendor.status]}>{titleCase(vendor.status)}</Badge>
        <span className="text-ink-500">
          Joined {formatDate(vendor.createdAt)}
          {vendor.approvedAt ? ` · approved ${formatDate(vendor.approvedAt)}` : ""}
        </span>
        <div className="ml-auto">
          <VendorStatusButtons vendorId={vendor.id} status={vendor.status} />
        </div>
      </div>
      {vendor.rejectionReason ? <p className="rounded-card bg-danger-soft p-4 text-danger">Reason: {vendor.rejectionReason}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Delivered sales" value={formatINR(vendor.stats.deliveredSales)} footnote={`${formatCount(vendor.stats.orders)} orders in all`} />
        <StatCard label="Commission earned" value={formatINR(vendor.stats.commissionEarned)} />
        <StatCard label="Shop earnings" value={formatINR(vendor.stats.vendorEarnings)} />
        <StatCard label="Items listed" value={formatCount(vendor.stats.listings)} footnote={`${vendor.stats.openTickets} open tickets`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card title="Branches">
            <ul className="flex flex-col">
              {vendor.branches.map((branch) => (
                <li key={branch.branchId} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 last:border-b-0">
                  <span>
                    <span className="font-semibold">{branch.branchName}</span>
                    <span className="block text-xs text-ink-500">
                      {branch.address}, {branch.city} · {branch.lat}, {branch.lng}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={branch.isOpen ? "success" : "neutral"}>{branch.isOpen ? "Open" : (branch.statusMessage ?? "Closed")}</Badge>
                    <Link href={`/inventory?vendorId=${vendor.id}`} className="text-xs font-semibold hover:underline">
                      Stock
                    </Link>
                    <Link href={`/orders?vendorId=${vendor.id}`} className="text-xs font-semibold hover:underline">
                      Orders
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Logins">
            <ul className="flex flex-col">
              {vendor.members.map((member) => (
                <li key={member.id} className="flex justify-between gap-2 border-b border-line px-5 py-3 last:border-b-0">
                  <span>
                    <span className="font-semibold">{member.name}</span>
                    <span className="block text-xs text-ink-500">
                      {member.email} · {member.phone}
                    </span>
                  </span>
                  <span className="text-xs text-ink-500">
                    {member.vendorRole === "OWNER" ? "Owner" : "Staff"}
                    {member.isBlocked ? " · blocked" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <VendorTermsCard vendorId={vendor.id} commissionBps={vendor.commissionBps} subscriptionsEnabled={vendor.subscriptionsEnabled} />
          <Card title="Details">
            <dl className="flex flex-col gap-2 p-5 text-ink-700">
              <div>
                <dt className="text-xs text-ink-500">Contact</dt>
                <dd>
                  {vendor.phone} · {vendor.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Address</dt>
                <dd>{vendor.address}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">GSTIN</dt>
                <dd>{vendor.gstin ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">ID proof</dt>
                <dd>
                  {vendor.idProofType ? `${vendor.idProofType} ${vendor.idProofNumber ?? ""}` : "—"}
                  {vendor.idProofUrl ? (
                    <a href={vendor.idProofUrl} target="_blank" rel="noreferrer" className="ml-2 font-semibold hover:underline">
                      View
                    </a>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Payouts to</dt>
                <dd>{vendor.payoutUpi ?? vendor.payoutDetails ?? "Not set"}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
