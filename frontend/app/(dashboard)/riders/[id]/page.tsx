import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RiderDeleteButton } from "@/components/riders/rider-delete-button";
import { RiderFormButton } from "@/components/riders/rider-form";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatDateTime, formatINR, titleCase } from "@/lib/format";
import { ApiError, api } from "@/lib/server/api";
import type { RiderDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Rider" };

export default function RiderPage({ params }: PageProps<"/riders/[id]">) {
  return (
    <>
      <Link href="/riders" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Riders
      </Link>
      <Suspense fallback={<TableSkeleton />}>
        <RiderContent params={params} />
      </Suspense>
    </>
  );
}

async function RiderContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rider = await api.get<RiderDetail>(`/admin/riders/${id}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  const details: [string, string | null][] = [
    ["Phone", rider.phone],
    ["WhatsApp", rider.whatsapp],
    ["Email", rider.email],
    ["Vehicle", `${titleCase(rider.vehicleType)}${rider.vehicleNumber ? ` · ${rider.vehicleNumber}` : ""}`],
    ["ID proof", rider.idProofType ? `${rider.idProofType} ${rider.idProofNumber ?? ""}` : null],
    ["Address", rider.address],
    ["Notes", rider.notes],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-bold">{rider.name}</h1>
          <Badge tone={rider.isActive ? "success" : "neutral"}>{rider.isActive ? "Active" : "Inactive"}</Badge>
        </div>
        <div className="flex gap-2">
          <RiderFormButton rider={rider} />
          <RiderDeleteButton id={rider.id} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Active deliveries" value={rider.stats.active} />
        <StatCard label="Delivered" value={rider.stats.delivered} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Details">
          <dl className="flex flex-col gap-3 p-5">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-ink-500">{label}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Recent assignments" className="xl:col-span-2">
          {rider.orders.length === 0 ? (
            <p className="p-5 text-ink-500">No orders assigned yet.</p>
          ) : (
            <Table minWidth={520}>
              <THead>
                <Th>Order</Th>
                <Th>Assigned</Th>
                <Th>Status</Th>
                <Th align="right">Amount</Th>
              </THead>
              <tbody>
                {rider.orders.map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link href={`/orders/${order.id}`} className="font-semibold hover:underline">
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td className="text-ink-700">{order.riderAssignedAt ? formatDateTime(order.riderAssignedAt) : "—"}</Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                    <Td numeric>{formatINR(order.payable)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
