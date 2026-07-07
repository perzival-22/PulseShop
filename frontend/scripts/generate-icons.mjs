// Renders the PulseShop logo SVG to the PWA icon set (192, 512, maskable).
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const logo = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#0D9488"/>
  <path d="M120 288 L 180 288 L 210 200 L 260 330 L 300 240 L 322 288 L 392 288"
        fill="none" stroke="#FFFFFF" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"
        transform="${pad ? "translate(51.2 51.2) scale(0.8)" : ""}"/>
</svg>`;

mkdirSync("public/icons", { recursive: true });

await sharp(Buffer.from(logo(false))).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(logo(false))).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(logo(true))).resize(512, 512).png().toFile("public/icons/maskable-512.png");

console.log("icons written to public/icons/");
