import type { Merchant, Product } from "@/types";
import type { OrderChannel } from "@/types";
import { discountedPrice, formatKes } from "./currency";

/** Pre-filled "ask about this product" message for the detail page contact icons. */
export function productInquiryLinks(merchant: Merchant, product: Product) {
  const msg = `Hi ${merchant.name}! I'm interested in "${product.name}" (${product.sku}) — ${formatKes(
    discountedPrice(product.priceKes, product.discountPct),
  )}. Is it available?`;
  return {
    whatsapp: `https://wa.me/${merchant.contacts.whatsapp}?text=${encodeURIComponent(msg)}`,
    instagram: `https://ig.me/m/${merchant.contacts.instagram}`,
    facebook: `https://m.me/${merchant.contacts.facebook}`,
  };
}

/** Pre-filled order message for SEND ORDER. */
export function orderLink(
  merchant: Merchant,
  product: Product,
  opts: { size: string | null; qty: number; name: string; phone: string; notes: string },
  channel: Exclude<OrderChannel, "direct">,
  reference: string,
) {
  const price = discountedPrice(product.priceKes, product.discountPct);
  const lines = [
    `🛍️ New order for ${merchant.name}`,
    ``,
    `• ${product.name} (${product.sku})`,
    opts.size ? `• Size: ${opts.size}` : null,
    `• Qty: ${opts.qty}`,
    `• Total: ${formatKes(price * opts.qty)}`,
    ``,
    `Ref: ${reference}`,
    `Name: ${opts.name}`,
    `Phone: ${opts.phone}`,
    opts.notes ? `Notes: ${opts.notes}` : null,
  ].filter((l): l is string => l !== null);
  const msg = lines.join("\n");

  // ig.me/m.me can't prefill a message the way wa.me does — callers should
  // copy `message` to the clipboard before opening `url` for those channels.
  const url =
    channel === "whatsapp"
      ? `https://wa.me/${merchant.contacts.whatsapp}?text=${encodeURIComponent(msg)}`
      : channel === "instagram"
        ? `https://ig.me/m/${merchant.contacts.instagram}`
        : `https://m.me/${merchant.contacts.facebook}`;
  return { url, message: msg };
}

/** Pre-filled order message for a multi-item cart checkout. */
export function cartOrderLink(
  merchant: Merchant,
  items: { name: string; size: string | null; qty: number; unitPrice: number }[],
  opts: { name: string; phone: string; notes: string },
  channel: Exclude<OrderChannel, "direct">,
  reference: string,
) {
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const lines = [
    `🛍️ New order for ${merchant.name}`,
    ``,
    ...items.map(
      (i) =>
        `• ${i.name}${i.size ? ` (Size ${i.size})` : ""} × ${i.qty} — ${formatKes(
          i.unitPrice * i.qty,
        )}`,
    ),
    ``,
    `Total: ${formatKes(total)}`,
    ``,
    `Ref: ${reference}`,
    `Name: ${opts.name}`,
    `Phone: ${opts.phone}`,
    opts.notes ? `Notes: ${opts.notes}` : null,
  ].filter((l): l is string => l !== null);
  const msg = lines.join("\n");

  const url =
    channel === "whatsapp"
      ? `https://wa.me/${merchant.contacts.whatsapp}?text=${encodeURIComponent(msg)}`
      : channel === "instagram"
        ? `https://ig.me/m/${merchant.contacts.instagram}`
        : `https://m.me/${merchant.contacts.facebook}`;
  return { url, message: msg };
}

export function merchantChatLink(merchant: Merchant) {
  const msg = `Hi ${merchant.name}! 👋`;
  return `https://wa.me/${merchant.contacts.whatsapp}?text=${encodeURIComponent(msg)}`;
}
