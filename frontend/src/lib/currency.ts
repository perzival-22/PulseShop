/**
 * Single source of truth for currency formatting.
 * Locked to KES for now; swap CURRENCY/LOCALE to make it configurable later.
 */
const CURRENCY = "KES";
const LOCALE = "en-KE";

const formatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatKes(amount: number): string {
  return formatter.format(amount);
}

/** Final price after any percentage discount. */
export function discountedPrice(price: number, discountPct: number | null): number {
  if (!discountPct) return price;
  return Math.round(price * (1 - discountPct / 100));
}
