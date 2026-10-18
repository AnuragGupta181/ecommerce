import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminMenu } from "./admin-menu";
import type { Portal } from "./nav-items";

export function Topbar({ portal }: { portal: Portal }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface px-6">
      <span className="text-base font-bold lg:hidden">{portal === "vendor" ? "Haat Shop" : "Haat Admin"}</span>
      <div className="hidden lg:block" />
      <Suspense fallback={<Skeleton className="h-9 w-40" />}>
        <AdminMenu />
      </Suspense>
    </header>
  );
}
