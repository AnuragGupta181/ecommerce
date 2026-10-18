import { Repeat } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import { PlanFormButton } from "@/components/vendor/plan-form";
import { formatINR, titleCase } from "@/lib/format";
import type { Listing, Plan } from "@/lib/marketplace-types";
import { api } from "@/lib/server/api";
import { deletePlan } from "./actions";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <PlansContent />
    </Suspense>
  );
}

async function PlansContent() {
  const [plans, listings] = await Promise.all([api.get<Plan[]>("/vendor/plans"), api.list<Listing>("/vendor/listings", { limit: 100 })]);
  const listingOptions = listings.items.map((listing) => ({
    id: listing.id,
    label: `${listing.product.name} · ${listing.variant.label} (${formatINR(listing.price)}, ${listing.branch.name})`,
  }));

  return (
    <>
      <PageHeader
        title="Subscription plans"
        description="Daily needs customers can subscribe to. Turn on subscriptions in Shop settings to appear under Daily essentials."
        actions={<PlanFormButton plan={null} listings={listingOptions} />}
      />
      <Card>
        {plans.length === 0 ? (
          <EmptyState icon={Repeat} title="No plans yet" description="Create a plan such as Morning milk with weekly and monthly prices." />
        ) : (
          <Table minWidth={900}>
            <THead>
              <Th>Plan</Th>
              <Th>Prices</Th>
              <Th>Slots</Th>
              <Th align="right">Subscribers</Th>
              <Th>Status</Th>
              <Th />
            </THead>
            <tbody>
              {plans.map((plan) => (
                <Tr key={plan.id}>
                  <Td>
                    <span className="flex items-center gap-3">
                      <Thumb src={plan.product.imageUrl} alt={plan.product.name} size={36} />
                      <span>
                        <span className="font-semibold">{plan.name}</span>
                        <span className="block text-xs text-ink-500">
                          {plan.quantityPerDelivery} × {plan.product.name} {plan.product.variantLabel} · usually {formatINR(plan.product.regularPrice)}
                        </span>
                      </span>
                    </span>
                  </Td>
                  <Td>
                    {plan.prices.map((price) => (
                      <p key={price.period} className="text-xs">
                        <span className="font-semibold">{titleCase(price.period)}</span> {formatINR(price.pricePerDelivery)}/drop
                        {price.deliveryFee ? ` + ${formatINR(price.deliveryFee)} ${price.deliveryFeeMode === "PER_PERIOD" ? "per period" : "per drop"}` : ", free delivery"}
                      </p>
                    ))}
                  </Td>
                  <Td className="text-xs text-ink-700">{plan.slots.join(", ") || "Any time"}</Td>
                  <Td numeric>
                    {plan.activeSubscribers}
                    {plan.capacity ? <span className="text-ink-500"> / {plan.capacity}</span> : null}
                  </Td>
                  <Td>
                    <Badge tone={plan.isActive ? (plan.isFull ? "warning" : "success") : "neutral"}>{plan.isActive ? (plan.isFull ? "Full" : "Open") : "Closed"}</Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <PlanFormButton plan={plan} listings={listingOptions} />
                      <ConfirmAction
                        label="Delete"
                        title={`Delete ${plan.name}?`}
                        description="Plans with subscribers are closed to new sign-ups instead of deleted; current subscribers keep their deliveries."
                        confirmLabel="Delete"
                        success="Plan removed"
                        action={deletePlan.bind(null, plan.id)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
