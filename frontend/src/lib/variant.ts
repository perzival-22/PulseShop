/**
 * How a chosen size/colour reads to a human, in one place.
 *
 * The same pair is shown on the cart line, the checkout summary, the buyer's
 * order history, the merchant's order list and the WhatsApp message. Formatting
 * it separately in six files is how "Size M" on one screen becomes "M" on the
 * next and "Colour: Navy" on a third — and the seller reading the message is
 * comparing it against what the buyer says they ordered.
 */
export function variantLabel(size: string | null, color: string | null): string | null {
  const parts = [size ? `Size ${size}` : null, color].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Stable identity for a cart/order line. Product id alone stopped being enough
 * the moment one product could be in the cart twice in different colours — a
 * duplicate React key silently reuses the wrong row's DOM state.
 */
export const variantKey = (size: string | null, color: string | null) =>
  `${size ?? "one"}-${color ?? "one"}`;
