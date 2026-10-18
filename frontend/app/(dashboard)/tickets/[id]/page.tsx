import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TicketView } from "@/components/tickets/ticket-view";
import { TableSkeleton } from "@/components/ui/skeleton";
import type { TicketDetail } from "@/lib/marketplace-types";
import { ApiError, api } from "@/lib/server/api";
import { replyTicket, setTicketLevel, setTicketStatus } from "../actions";

export const metadata: Metadata = { title: "Ticket" };

export default function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  return (
    <>
      <Link href="/tickets" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Tickets
      </Link>
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <TicketContent params={params} />
      </Suspense>
    </>
  );
}

async function TicketContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await api.get<TicketDetail>(`/admin/tickets/${id}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  return <TicketView portal="admin" ticket={ticket} actions={{ reply: replyTicket, setStatus: setTicketStatus, setLevel: setTicketLevel }} />;
}
