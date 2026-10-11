"use client";

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-brand-500" : "bg-ink-300"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-surface shadow transition-[left] ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span className="text-ink-700">{label}</span>
    </label>
  );
}
