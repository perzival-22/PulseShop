// Verifies the service worker precaches the shell and the storefront loads offline.
// Also captures screenshots of the key screens.
import { chromium } from "playwright";

const BASE = "http://localhost:4173";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

// first visit: let the SW install and precache
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1500);
await page.screenshot({ path: "scripts/shot-storefront.png", fullPage: false });

// go offline and reload
await ctx.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const offlineOk = await page.locator("text=PulseShop").count();
console.log(offlineOk > 0 ? "PASS offline: storefront shell loads offline" : "FAIL offline: shell did not load");
await ctx.setOffline(false);

// detail + dashboard screenshots
await page.goto(`${BASE}/product/p8`, { waitUntil: "networkidle" });
await page.screenshot({ path: "scripts/shot-detail.png" });
await page.goto(`${BASE}/order/p8`, { waitUntil: "networkidle" });
await page.screenshot({ path: "scripts/shot-order.png" });

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await desktop.newPage();
await dpage.goto(`${BASE}/dashboard/inventory`, { waitUntil: "networkidle" });
await dpage.waitForTimeout(800);
await dpage.screenshot({ path: "scripts/shot-dashboard.png" });

await browser.close();
console.log("screenshots saved");
