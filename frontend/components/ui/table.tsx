import type { ComponentProps, ReactNode } from "react";

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-surface">
      <tr className="border-b border-line">{children}</tr>
    </thead>
  );
}

export function Th({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold tracking-wider whitespace-nowrap text-ink-500 uppercase ${alignClass[align]} ${className}`}>
      {children}
    </th>
  );
}

export function Tr({ className = "", ...props }: ComponentProps<"tr">) {
  return <tr className={`border-b border-line last:border-b-0 hover:bg-brand-50 ${className}`} {...props} />;
}

export function Td({ children, align = "left", numeric, className = "" }: { children?: ReactNode; align?: "left" | "right" | "center"; numeric?: boolean; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${alignClass[numeric ? "right" : align]} ${numeric ? "tabular" : ""} ${className}`}>{children}</td>;
}
