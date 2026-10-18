import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MarkPaidCard } from "@/components/payouts/payout-controls";
import { PayoutPage, type PayoutDetail } from "@/components/payouts/payout-page";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/server/api";

export const metadata: Metadata = { title: "Payout" };

export default function AdminPayoutPage({ params }: PageProps<"/payouts/[id]">) {
  return (
    <>
      <Link href="/payouts" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Payouts
      </Link>
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payout = await api.get<PayoutDetail>(`/admin/payouts/${id}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  return (
    <PayoutPage payout={payout} portal="admin">
      {payout.status === "PENDING" ? (
        <>
          <Card title="Shop's payout details">
            <p className="p-5 text-ink-700">
              {payout.vendor.payoutUpi ? `UPI: ${payout.vendor.payoutUpi}` : "No UPI on file."} {payout.vendor.payoutDetails ?? ""}
            </p>
          </Card>
          <MarkPaidCard payoutId={payout.id} />
        </>
      ) : null}
    </PayoutPage>
  );
}
