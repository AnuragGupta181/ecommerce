import { Star } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewActions } from "@/components/marketing/review-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { api } from "@/lib/server/api";
import type { Review } from "@/lib/types";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  return (
    <>
      <PageHeader title="Reviews" description="Hidden reviews are excluded from product ratings" />
      <Suspense fallback={<TableSkeleton />}>
        <ReviewsList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ReviewsList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = { q: param(params, "q"), rating: param(params, "rating"), hidden: param(params, "hidden") };
  const { items, meta } = await api.list<Review>("/admin/reviews", { ...filters, page: pageParam(params), limit: 20 });

  return (
    <Card>
      <FilterBar action="/reviews">
        <SearchInput name="q" defaultValue={filters.q} placeholder="Product, customer or text" />
        <FilterSelect name="rating" defaultValue={filters.rating ?? ""}>
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {rating} star{rating === 1 ? "" : "s"}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect name="hidden" defaultValue={filters.hidden ?? ""}>
          <option value="">Visible and hidden</option>
          <option value="false">Visible</option>
          <option value="true">Hidden</option>
        </FilterSelect>
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState icon={Star} title="No reviews found" />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {items.map((review) => (
              <li key={review.id} className={`flex flex-wrap items-start justify-between gap-4 p-5 ${review.isHidden ? "bg-canvas" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold text-white ${review.rating >= 3 ? "bg-success" : "bg-danger"}`}>
                      {review.rating} <Star size={11} fill="currentColor" />
                    </span>
                    <span className="font-semibold">{review.title ?? "No title"}</span>
                    {review.isHidden ? <Badge>Hidden</Badge> : null}
                  </div>
                  {review.comment ? <p className="mt-1.5 text-ink-700">{review.comment}</p> : null}
                  <p className="mt-1.5 text-xs text-ink-500">
                    {review.user.name} on <span className="font-semibold text-ink-700">{review.product.name}</span> · {formatDate(review.createdAt)}
                  </p>
                </div>
                <ReviewActions id={review.id} isHidden={review.isHidden} />
              </li>
            ))}
          </ul>
          <Pagination meta={meta} pathname="/reviews" params={params} />
        </>
      )}
    </Card>
  );
}
