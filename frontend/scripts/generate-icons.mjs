// Renders the PulseShop logo image to the PWA icon set (192, 512, maskable).
// Source mirrors src/components/common/Logo.tsx so the favicon/PWA icons match the in-app badge.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "src/assets/pulseshoplogo1.jpg";

mkdirSync("public/icons", { recursive: true });

// The source is wider than it is tall, so every square render below centre-crops it.
// The cart sits centred in the frame; the trim only takes decorative speed lines.
const square = { fit: "cover", position: "centre" };

// Standard icons — the source already carries its own branded background, so full-bleed.
await sharp(SRC).resize(192, 192, square).png().toFile("public/icons/icon-192.png");
await sharp(SRC).resize(512, 512, square).png().toFile("public/icons/icon-512.png");

// Maskable — inset the art to ~80% (the safe zone) so circular/rounded masks don't clip the cart.
// The padding replicates the logo's own edge pixels rather than a flat fill: the source's
// background is a teal gradient, so any single colour leaves a visible seam around the inset.
await sharp(SRC)
  .resize(410, 410, square)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, extendWith: "copy" })
  .png()
  .toFile("public/icons/maskable-512.png");

console.log("icons written to public/icons/");
