import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatCount } from "@/lib/format";
import { hrefWith, type SearchParams } from "@/lib/search-params";
import type { PageMeta } from "@/lib/types";

export function Pagination({ meta, pathname, params }: { meta: PageMeta; pathname: string; params: SearchParams }) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const linkClass = "flex size-8 items-center justify-center rounded-lg border border-line bg-surface hover:bg-brand-50";
  const disabledClass = "flex size-8 items-center justify-center rounded-lg border border-line text-ink-300";

  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3 text-ink-500">
      <span className="tabular">
        {formatCount(from)}–{formatCount(to)} of {formatCount(meta.total)}
      </span>
      <div className="flex items-center gap-2">
        {meta.page > 1 ? (
          <Link href={hrefWith(pathname, params, { page: meta.page - 1 })} className={linkClass} aria-label="Previous page">
            <ChevronLeft size={16} />
          </Link>
        ) : (
          <span className={disabledClass}>
            <ChevronLeft size={16} />
          </span>
        )}
        <span className="tabular text-ink-700">
          {meta.page} / {meta.totalPages}
        </span>
        {meta.page < meta.totalPages ? (
          <Link href={hrefWith(pathname, params, { page: meta.page + 1 })} className={linkClass} aria-label="Next page">
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span className={disabledClass}>
            <ChevronRight size={16} />
          </span>
        )}
      </div>
    </div>
  );
}
