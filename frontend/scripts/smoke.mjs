// Headless smoke test against the vite preview server (default :4173).
// Checks each route renders, key UI is present, and no console errors fire.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const failures = [];
const consoleErrors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(`${page.url()} :: ${msg.text()}`);
});
page.on("pageerror", (err) => consoleErrors.push(`${page.url()} :: ${err.message}`));

async function expect(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message.split("\n")[0]}`);
    console.log(`FAIL ${name} — ${e.message.split("\n")[0]}`);
  }
}

// 1. storefront
await page.goto(BASE, { waitUntil: "networkidle" });
await expect("storefront: merchant hero renders", () =>
  page.waitForSelector("text=Zawadi Styles", { timeout: 8000 }));
await expect("storefront: product grid renders", () =>
  page.waitForSelector("text=Classic White Tee", { timeout: 8000 }));
await expect("storefront: category pill filters grid", async () => {
  await page.click("button:has-text('Dresses')");
  await page.waitForSelector("text=Floral Midi Dress", { timeout: 4000 });
  const tee = await page.locator("text=Classic White Tee").count();
  if (tee > 0) throw new Error("Tops still visible after filtering to Dresses");
  await page.click("button:has-text('All')");
});
await expect("storefront: sold-out overlay visible", () =>
  page.waitForSelector("text=Sold Out", { timeout: 4000 }));

// 2. favorite toggle + nav badge
await expect("favorites: heart toggle updates nav badge", async () => {
  await page.locator("[aria-label='Add to favorites']").first().click();
  await page.waitForSelector("nav a[href='/favorites'] span:has-text('1')", { timeout: 4000 });
});

// 3. product detail
await page.click("text=Classic White Tee");
await expect("detail: gallery + price render", () =>
  page.waitForSelector("text=/Ksh|KES/", { timeout: 8000 }));
await expect("detail: stock label shows piece count", () =>
  page.waitForSelector("text=pieces available", { timeout: 4000 }));
await expect("detail: size selector activates", async () => {
  await page.click("[role='radio']:has-text('M')");
  const checked = await page.getAttribute("[role='radio']:has-text('M')", "aria-checked");
  if (checked !== "true") throw new Error("size M not active");
});
await expect("detail: contact deep links present", async () => {
  const href = await page.getAttribute("[aria-label='Ask on WhatsApp']", "href");
  if (!href?.startsWith("https://wa.me/")) throw new Error(`bad href: ${href}`);
});

// 4. order form
await page.click("button:has-text('ORDER NOW')");
await expect("order: form renders with size carried over", () =>
  page.waitForSelector("text=Size M", { timeout: 8000 }));
await expect("order: validation blocks empty form", async () => {
  await page.click("button:has-text('SEND ORDER')");
  await page.waitForSelector("text=Enter your full name", { timeout: 4000 });
});
await expect("order: payment sheet M-Pesa flow pending → success", async () => {
  await page.fill("input[name='name']", "Test Customer");
  await page.fill("input[name='phone']", "+254712345678");
  await page.click("button:has-text('PAY NOW')");
  await page.waitForSelector("text=Complete Payment", { timeout: 4000 });
  await page.click("button:has-text('Send STK Prompt')");
  await page.waitForSelector("text=Check your phone", { timeout: 4000 });
  await page.waitForSelector("text=Payment successful", { timeout: 8000 });
  await page.click("button:has-text('Done')");
});

// 5. favorites page
await page.goto(`${BASE}/favorites`, { waitUntil: "networkidle" });
await expect("favorites: saved product listed", () =>
  page.waitForSelector("text=saved item", { timeout: 8000 }));

// 6. orders page
await page.goto(`${BASE}/orders`, { waitUntil: "networkidle" });
await expect("orders: placed order listed with Paid badge", () =>
  page.waitForSelector("text=Paid", { timeout: 8000 }));

// 7. dashboard (desktop viewport)
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await desktop.newPage();
dpage.on("console", (m) => m.type() === "error" && consoleErrors.push(`${dpage.url()} :: ${m.text()}`));
dpage.on("pageerror", (e) => consoleErrors.push(`${dpage.url()} :: ${e.message}`));
await dpage.goto(`${BASE}/dashboard/inventory`, { waitUntil: "networkidle" });
await expect("dashboard: stat cards render", () =>
  dpage.waitForSelector("text=Total Products", { timeout: 8000 }));
await expect("dashboard: table shows SKU chips", () =>
  dpage.waitForSelector("text=TOP-001", { timeout: 8000 }));
await expect("dashboard: search filters table", async () => {
  await dpage.fill("input[placeholder*='Search']", "watch");
  await dpage.waitForSelector("text=Minimalist Watch", { timeout: 4000 });
  await dpage.waitForTimeout(400);
  const rows = await dpage.locator("tbody tr").count();
  if (rows !== 1) throw new Error(`expected 1 row, got ${rows}`);
  await dpage.fill("input[placeholder*='Search']", "");
  await dpage.waitForTimeout(400);
});
await expect("dashboard: add product modal opens with dropzone", async () => {
  await dpage.click("button:has-text('Add New Product')");
  await dpage.waitForSelector("text=Drag & drop images", { timeout: 4000 });
  await dpage.keyboard.press("Escape");
});
await expect("dashboard: stock counter pulses Syncing → DB Synced", async () => {
  await dpage.click("[aria-label='Edit Classic White Tee']");
  await dpage.waitForSelector("text=DB Synced", { timeout: 4000 });
  await dpage.click("[aria-label='Increase stock']");
  await dpage.waitForSelector("text=Syncing…", { timeout: 2000 });
  await dpage.waitForSelector("text=DB Synced", { timeout: 3000 });
  await dpage.keyboard.press("Escape");
});

// 8. dev components gallery
await page.goto(`${BASE}/dev/components`, { waitUntil: "networkidle" });
await expect("dev: component gallery renders", () =>
  page.waitForSelector("text=Component Gallery", { timeout: 8000 }));

// 9. manifest + SW registered
await expect("pwa: manifest served", async () => {
  const res = await page.request.get(`${BASE}/manifest.webmanifest`);
  if (res.status() !== 200) throw new Error(`manifest ${res.status()}`);
});
await expect("pwa: service worker file served", async () => {
  const res = await page.request.get(`${BASE}/sw.js`);
  if (res.status() !== 200) throw new Error(`sw.js ${res.status()}`);
});

await browser.close();

console.log("\n--- summary ---");
if (consoleErrors.length) {
  console.log("console errors:");
  for (const e of [...new Set(consoleErrors)]) console.log("  " + e);
}
if (failures.length) {
  console.log(`${failures.length} FAILURES`);
  process.exit(1);
}
console.log(`all checks passed${consoleErrors.length ? " (but console errors above)" : ", no console errors"}`);
