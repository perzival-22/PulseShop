import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingRow({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-stone-300",
            )}
          />
        ))}
      </div>
      <span className="text-sm font-bold text-ink">{rating.toFixed(1)}</span>
      <span className="text-sm text-muted">({reviewCount} reviews)</span>
    </div>
  );
}
