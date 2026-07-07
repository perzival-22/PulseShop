import { Heart } from "lucide-react";
import { Link } from "react-router";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";
import { discountedPrice, formatKes } from "@/lib/currency";
import { useFavorites } from "@/stores/favorites";
import { StockBadge } from "./StockBadge";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const isFavorite = useFavorites((s) => s.isFavorite(product.id));
  const toggle = useFavorites((s) => s.toggle);
  const soldOut = product.status === "out";
  const finalPrice = discountedPrice(product.priceKes, product.discountPct);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-card bg-card shadow-soft transition-shadow hover:shadow-md",
        className,
      )}
    >
      <Link
        to={`/product/${product.id}`}
        aria-disabled={soldOut}
        onClick={(e) => soldOut && e.preventDefault()}
        className={cn("block", soldOut && "cursor-default")}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-stone-100">
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className={cn(
              "size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]",
              soldOut && "opacity-40",
            )}
          />
          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-ink/85 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                Sold Out
              </span>
            </div>
          )}
          {product.discountPct != null && !soldOut && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-favorite px-2 py-0.5 text-[11px] font-bold text-white">
              -{product.discountPct}%
            </span>
          )}
        </div>
        <div className="space-y-1.5 p-3">
          <h3 className="truncate text-sm font-semibold text-ink">{product.name}</h3>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-extrabold text-ink">{formatKes(finalPrice)}</span>
            {product.discountPct != null && (
              <span className="text-xs font-medium text-muted line-through">
                {formatKes(product.priceKes)}
              </span>
            )}
          </div>
          {!soldOut && <StockBadge status={product.status} />}
        </div>
      </Link>

      <button
        type="button"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={isFavorite}
        onClick={() => toggle(product.id)}
        className="absolute right-2.5 top-2.5 flex size-9 items-center justify-center rounded-full bg-white/90 shadow-soft backdrop-blur transition-transform active:scale-90"
      >
        <Heart
          className={cn(
            "size-[18px] transition-colors",
            isFavorite ? "fill-favorite text-favorite" : "text-stone-500",
          )}
        />
      </button>
    </div>
  );
}
