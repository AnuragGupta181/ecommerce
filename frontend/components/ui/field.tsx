import type { ComponentProps, ReactNode } from "react";

export const controlClass =
  "h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-600 focus:outline-none disabled:bg-canvas aria-[invalid=true]:border-danger";

type FieldProps = { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode };

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${controlClass} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${controlClass} h-auto min-h-24 py-2 ${className}`} {...props} />;
}
