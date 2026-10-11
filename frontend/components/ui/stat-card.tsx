import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({ label, value, change, footnote }: { label: string; value: ReactNode; change?: number | null; footnote?: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-ink-500">{label}</p>
      <p className="tabular mt-2 text-[26px] leading-8 font-extrabold">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {change === undefined ? null : change === null ? (
          <span className="rounded-full bg-canvas px-2 py-0.5 font-semibold text-ink-500">New</span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${
              change >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
          >
            {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(change)}%
          </span>
        )}
        {footnote ? <span className="text-ink-500">{footnote}</span> : null}
      </div>
    </div>
  );
}
