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
import { assignVendorRider, resendVendorNotifications, updateVendorOrderStatus } from "../actions";

export const metadata: Metadata = { title: "Order" };

export default function VendorOrderPage({ params }: PageProps<"/vendor/orders/[id]">) {
  return (
    <>
      <Link href="/vendor/orders" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
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
  const [order, riders] = await Promise.all([
    api.get<MarketplaceOrderDetail>(`/vendor/orders/${id}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    api.list<RiderRow>("/vendor/riders", { active: "true", limit: 100 }),
  ]);

  return (
    <OrderView
      portal="vendor"
      order={order}
      riders={riders.items}
      actions={{ updateStatus: updateVendorOrderStatus, assignRider: assignVendorRider, resend: resendVendorNotifications }}
    />
  );
}
