import type { StockStatus } from "@/types";

export const STOCK_LABEL: Record<StockStatus, string> = {
  available: "Available",
  low: "Low Stock",
  out: "Out of Stock",
};

/** Stock qty at or below this (and above 0) counts as "low". */
export const LOW_STOCK_THRESHOLD = 5;

export function statusForQty(qty: number): StockStatus {
  if (qty <= 0) return "out";
  if (qty <= LOW_STOCK_THRESHOLD) return "low";
  return "available";
}

export const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Accessories"] as const;
