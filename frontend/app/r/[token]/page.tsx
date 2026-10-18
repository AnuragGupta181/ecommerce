import { MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, titleCase } from "@/lib/format";
import type { RiderSchedule } from "@/lib/marketplace-types";
import { ApiError, publicApi } from "@/lib/server/api";
import { deliveryTone } from "@/lib/status-tones";
import { DeliveredButton } from "./delivered-button";

export const metadata: Metadata = { title: "Today's deliveries", robots: { index: false, follow: false } };

/** The rider's private page: no login, phone-first layout, opened from a link in WhatsApp or email. */
export default function RiderPage({ params }: PageProps<"/r/[token]">) {
  return (
    <main className="min-h-screen bg-canvas px-4 py-6">
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Schedule params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Schedule({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let schedule: RiderSchedule;
  try {
    schedule = await publicApi.get<RiderSchedule>(`/rider-schedule/${encodeURIComponent(token)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) {
      return <p className="rounded-card border border-line bg-surface p-6 text-center">This link is no longer valid. Ask the shop for a new one.</p>;
    }
    throw error;
  }

  return (
    <>
      <header>
        <p className="text-ink-500">{schedule.rider.shop ?? "Haat"}</p>
        <h1 className="text-xl font-bold">
          {schedule.rider.name}, {formatDate(schedule.date)}
        </h1>
        {schedule.rider.shopPhone ? (
          <a href={`tel:${schedule.rider.shopPhone}`} className="text-xs font-semibold hover:underline">
            Call the shop: {schedule.rider.shopPhone}
          </a>
        ) : null}
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Subscription drops ({schedule.today.length})</h2>
        {schedule.today.length === 0 ? <p className="text-ink-500">No drops today.</p> : null}
        {schedule.today.map((drop) => (
          <article key={drop.id} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{drop.customer.name}</p>
                <p className="text-ink-700">
                  {drop.quantity} × {drop.product} · {drop.slot ?? "any time"}
                </p>
              </div>
              <Badge tone={deliveryTone[drop.status]}>{titleCase(drop.status)}</Badge>
            </div>
            <p className="text-ink-700">{drop.address}</p>
            <div className="flex flex-wrap items-center gap-2">
              {drop.customer.phone ? (
                <a href={`tel:${drop.customer.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-semibold">
                  <Phone size={12} /> Call
                </a>
              ) : null}
              {drop.mapUrl ? (
                <a href={drop.mapUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-semibold">
                  <MapPin size={12} /> Map
                </a>
              ) : null}
              <span className="flex-1" />
              {drop.status === "SCHEDULED" ? <DeliveredButton token={token} deliveryId={drop.id} /> : null}
            </div>
          </article>
        ))}
      </section>

      {schedule.orders.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold">Orders to deliver ({schedule.orders.length})</h2>
          {schedule.orders.map((order) => (
            <article key={order.id} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
              <p className="font-semibold">
                {order.orderNumber} · {order.shippingAddress.name}
              </p>
              <p className="text-ink-700">{order.items.map((item) => `${item.quantity} × ${item.productName}`).join(", ")}</p>
              <p className="text-ink-700">
                {order.shippingAddress.line1}, {order.shippingAddress.city}
              </p>
              <p className="font-semibold">
                {order.paymentMethod === "COD" ? `Collect cash: ${order.collect}` : `Collect by UPI: ${order.collect}`}
              </p>
              <a href={`tel:${order.shippingAddress.phone}`} className="text-xs font-semibold hover:underline">
                Call {order.shippingAddress.phone}
              </a>
            </article>
          ))}
        </section>
      ) : null}

      {schedule.month.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">Coming up</h2>
          <ul className="grid grid-cols-3 gap-2">
            {schedule.month.map((day) => (
              <li key={day.date} className="rounded-control border border-line bg-surface p-2 text-center">
                <p className="text-xs font-semibold">{formatDate(day.date)}</p>
                <p className="text-xs text-ink-500">
                  {day.drops} drops · {day.units} units
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
