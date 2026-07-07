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
    `Name: ${opts.name}`,
    `Phone: ${opts.phone}`,
    opts.notes ? `Notes: ${opts.notes}` : null,
  ].filter((l): l is string => l !== null);
  const msg = lines.join("\n");

  switch (channel) {
    case "whatsapp":
      return `https://wa.me/${merchant.contacts.whatsapp}?text=${encodeURIComponent(msg)}`;
    case "instagram":
      return `https://ig.me/m/${merchant.contacts.instagram}`;
    case "facebook":
      return `https://m.me/${merchant.contacts.facebook}`;
  }
}

export function merchantChatLink(merchant: Merchant) {
  const msg = `Hi ${merchant.name}! 👋`;
  return `https://wa.me/${merchant.contacts.whatsapp}?text=${encodeURIComponent(msg)}`;
}
