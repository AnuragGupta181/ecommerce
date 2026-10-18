import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

/** Shown the moment a sidebar link is clicked, while the server renders the page (route loading.tsx). */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <TableSkeleton />
    </div>
  );
}
