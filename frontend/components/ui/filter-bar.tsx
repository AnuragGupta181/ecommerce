"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { controlClass } from "./field";

/** GET form: filters live in the URL, so results are shareable and rendered on the server. */
export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  return (
    <Form action={action} replace className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      {children}
      <button type="submit" className="sr-only">
        Apply filters
      </button>
    </Form>
  );
}

export function SearchInput({ placeholder = "Search", ...props }: ComponentProps<"input">) {
  return (
    <div className="relative min-w-56 flex-1">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500" />
      <input type="search" placeholder={placeholder} className={`${controlClass} pl-9`} {...props} />
    </div>
  );
}

/** Submits its form on change so selects behave like instant filters. */
export function FilterSelect({ children, className = "", ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={`${controlClass} w-auto min-w-36 ${className}`} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  );
}
