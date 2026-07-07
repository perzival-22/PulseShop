import type { StockStatus } from "@/types";
import { STOCK_LABEL } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";

const toneFor: Record<StockStatus, "success" | "warning" | "danger"> = {
  available: "success",
  low: "warning",
  out: "danger",
};

export function StockBadge({ status, label }: { status: StockStatus; label?: string }) {
  return (
    <Badge tone={toneFor[status]} dot>
      {label ?? STOCK_LABEL[status]}
    </Badge>
  );
}

/** Detail-page variant: "14 pieces available" / "Only 3 left!" / "Out of stock" */
export function stockDetailLabel(status: StockStatus, qty: number): string {
  if (status === "out") return "Out of stock";
  if (status === "low") return `Only ${qty} left!`;
  return `${qty} pieces available`;
}
