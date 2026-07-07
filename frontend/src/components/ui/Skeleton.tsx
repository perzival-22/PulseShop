import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-card bg-stone-200/70", className)} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card bg-card shadow-soft">
      <Skeleton className="aspect-[3/4] rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}
