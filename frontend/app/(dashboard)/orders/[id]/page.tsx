import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderView } from "@/components/orders/order-view";
import { TableSkeleton } from "@/components/ui/skeleton";
import type { MarketplaceOrderDetail } from "@/lib/marketplace-types";
import { ApiError, api } from "@/lib/server/api";
import type { RiderRow } from "@/lib/types";
import { assignRider, resendNotifications, saveAdminNote, updateOrderStatus } from "../actions";

export const metadata: Metadata = { title: "Order" };

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Orders
      </Link>
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <OrderContent params={params} />
      </Suspense>
    </>
  );
}

async function OrderContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await api.get<MarketplaceOrderDetail>(`/admin/orders/${id}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  // A shop's own delivery partners carry its orders.
  const riders = await api.list<RiderRow>("/admin/riders", { active: "true", vendorId: order.vendor?.id, limit: 100 });

  return (
    <OrderView
      portal="admin"
      order={order}
      riders={riders.items}
      actions={{ updateStatus: updateOrderStatus, assignRider, resend: resendNotifications, saveNote: saveAdminNote }}
    />
  );
}
