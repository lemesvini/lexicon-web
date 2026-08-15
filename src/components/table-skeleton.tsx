import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder that holds a @/components/data-table's shape while it loads. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-full max-w-sm" />
        <Skeleton className="ml-auto h-6 w-24" />
      </div>
      <div className="space-y-px overflow-hidden rounded-md border p-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
