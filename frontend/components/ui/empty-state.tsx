import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-ink-900">
        <Icon size={22} strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-base font-semibold">{title}</p>
        {description ? <p className="mt-1 max-w-sm text-ink-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
