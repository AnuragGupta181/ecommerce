import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { PaymentForm, SubscriptionRiderPicker } from "@/components/vendor/subscription-controls";
import { downloadHref } from "@/lib/download-href";
import { formatDate, formatDateTime, formatINR, titleCase } from "@/lib/format";
import type { SubscriptionDetail } from "@/lib/marketplace-types";
import { deliveryTone } from "@/lib/status-tones";
import { ApiError, api } from "@/lib/server/api";
import type { RiderRow } from "@/lib/types";

export const metadata: Metadata = { title: "Subscription" };

export default function SubscriptionPage({ params }: PageProps<"/vendor/subscriptions/[id]">) {
  return (
    <>
      <Link href="/vendor/subscriptions" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Subscribers
      </Link>
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <SubscriptionContent params={params} />
      </Suspense>
    </>
  );
}

async function SubscriptionContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [sub, riders] = await Promise.all([
    api.get<SubscriptionDetail>(`/vendor/subscriptions/${id}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    api.list<RiderRow>("/vendor/riders", { active: "true", limit: 100 }),
  ]);
  const { ledger } = sub;
  const fee = sub.deliveryFee ? `${formatINR(sub.deliveryFee)} ${sub.deliveryFeeMode === "PER_PERIOD" ? "per period" : "per drop"}` : "free";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold">{sub.number}</h1>
        <Badge tone={sub.status === "ACTIVE" ? "success" : "neutral"}>{titleCase(sub.status)}</Badge>
        <span className="text-ink-500">
          {sub.plan.name} · {titleCase(sub.period)} · {formatDate(sub.startDate)} – {formatDate(sub.endDate)}
        </span>
        <a href={downloadHref("/vendor/download", `/documents/statement/${sub.id}`)} className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 font-semibold hover:bg-brand-50">
          <FileText size={14} /> Statement
        </a>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card title="Account">
            <dl className="grid gap-4 p-5 sm:grid-cols-4">
              {(
                [
                  ["Charged so far", ledger.charged],
                  ["Paid", ledger.paid],
                  ["Balance", ledger.balance],
                  ["Whole period", ledger.expectedTotal],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-ink-500">{label}</dt>
                  <dd className="tabular text-lg font-bold">{formatINR(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-line px-5 py-3 text-ink-700">
              {sub.quantity} × {sub.product.name} {sub.product.variantLabel} at {formatINR(sub.pricePerDelivery)} per drop, delivery {fee}. Days: {sub.weekdays.join(", ")}. Slot{" "}
              {sub.slot ?? "any time"}. Pays {titleCase(sub.paymentPlan).toLowerCase()}.
            </p>
            {ledger.instalments.length > 0 ? (
              <Table minWidth={420}>
                <THead>
                  <Th>Instalment</Th>
                  <Th>Due</Th>
                  <Th align="right">Amount</Th>
                  <Th>Status</Th>
                </THead>
                <tbody>
                  {ledger.instalments.map((instalment) => (
                    <Tr key={instalment.sequence}>
                      <Td>#{instalment.sequence}</Td>
                      <Td>{formatDate(instalment.dueDate)}</Td>
                      <Td numeric>{formatINR(instalment.amount)}</Td>
                      <Td>{titleCase(instalment.status)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : null}
          </Card>

          <Card title={`Deliveries (${sub.deliveries.length})`}>
            <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4 lg:grid-cols-6">
              {sub.deliveries.map((drop) => (
                <div key={drop.id} className="rounded-control border border-line p-2" title={drop.note ?? undefined}>
                  <p className="text-xs font-semibold">{formatDate(drop.date)}</p>
                  <Badge tone={deliveryTone[drop.status]}>{titleCase(drop.status)}</Badge>
                </div>
              ))}
            </div>
            {sub.pauses.length > 0 ? (
              <p className="border-t border-line px-5 py-3 text-ink-700">
                Paused: {sub.pauses.map((pause) => `${formatDate(pause.fromDate)} – ${formatDate(pause.toDate)}`).join(", ")}
              </p>
            ) : null}
          </Card>

          <Card title="Payments">
            {sub.payments.length === 0 ? (
              <p className="p-5 text-ink-500">No payments yet.</p>
            ) : (
              <Table minWidth={520}>
                <THead>
                  <Th>Receipt</Th>
                  <Th>Method</Th>
                  <Th align="right">Amount</Th>
                  <Th />
                </THead>
                <tbody>
                  {sub.payments.map((payment) => (
                    <Tr key={payment.id}>
                      <Td>
                        <p className="font-semibold">{payment.receiptNumber}</p>
                        <p className="text-xs text-ink-500">
                          {formatDateTime(payment.paidAt)}
                          {payment.note ? ` · ${payment.note}` : ""}
                        </p>
                      </Td>
                      <Td>{titleCase(payment.method)}</Td>
                      <Td numeric className={payment.amount < 0 ? "text-danger" : "font-semibold"}>
                        {formatINR(payment.amount)}
                      </Td>
                      <Td align="right">
                        <a href={downloadHref("/vendor/download", `/documents/receipt/${payment.id}`)} className="inline-flex items-center gap-1 text-xs font-semibold hover:underline">
                          <FileText size={12} /> PDF
                        </a>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {sub.status === "ACTIVE" ? <PaymentForm subscriptionId={sub.id} dueNow={ledger.dueNow} /> : null}
          <Card title="Rider">
            <div className="flex flex-col gap-2 p-5">
              <SubscriptionRiderPicker subscriptionId={sub.id} current={sub.rider?.id ?? null} riders={riders.items.map((rider) => ({ id: rider.id, name: rider.name }))} />
              <p className="text-xs text-ink-500">The rider gets a private link with this customer&apos;s drops.</p>
            </div>
          </Card>
          <Card title="Customer">
            <div className="flex flex-col gap-1 p-5 text-ink-700">
              <p className="font-semibold text-ink-900">{sub.customer.name}</p>
              <p>{sub.customer.phone}</p>
              <address className="mt-2 not-italic">
                {sub.shippingAddress.line1}
                {sub.shippingAddress.line2 ? `, ${sub.shippingAddress.line2}` : ""}
                <br />
                {sub.shippingAddress.city} {sub.shippingAddress.pincode}
              </address>
              {sub.cancelReason ? <p className="mt-2 text-danger">Cancelled: {sub.cancelReason}</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
