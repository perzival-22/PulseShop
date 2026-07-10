# PulseShop — Code & Database Audit

_Audit date: 2026-07-10. Covers: frontend (React/Vite), backend (Express), Supabase migrations, automation scripts, deploy config. Ordered roughly by severity._

**Suggested attack order:** apply migration 0004 → fix the storage and orders RLS policies → decide the backend's fate → fix the order-reference/atomicity/stock trio → then work down the frontend bug list.

---

## 1. Critical — broken right now

### 1.1 The entire `backend/` Express service targets a schema that doesn't exist
Every controller queries `shops` (with `owner_id`), `products.shop_id/price/stock`, `orders.quantity/status`, and a `cart_items` table. The real database has `merchants`, `products.merchant_id/price_kes/stock_qty`, and `orders` + `order_items`. Every endpoint would 500 at runtime. Additionally:

- [ ] `backend/src/modules/merchant/merchant.controller.ts:63` calls `extractSocialHandle` **without importing it** — the backend doesn't compile.
- [ ] `backend/src/index.ts` never calls `app.listen()` and never calls `dotenv.config()`, so `npm start` either crashes on the missing-env throw in `db/supabase.ts:7` or exits immediately.
- [ ] Only `productRoutes` is mounted; `merchant.routes.ts` and `order.routes.ts` are never wired in, `auth.controller.ts` has no route file, `cart.controller.ts` has no routes.
- [ ] `cors` is a dependency but never used.
- [ ] `updateOrderStatus` validates statuses (`processing`, `shipped`, `delivered`…) that don't exist in the DB's `payment_status` enum.
- [ ] The Jest tests test the phantom schema — green tests prove nothing about the real DB.

**Decision needed:** rewrite this backend against the real schema (it's the right home for the payments endpoints — it already holds the service-role key), or delete it until it's real.

### 1.2 Migration `0004_shopper_follows.sql` is written but NOT applied to the remote DB
Until applied, on production:
- Shopper signups still get a merchant row (old `handle_new_user` runs), so every "shopper" logs in as a merchant with an auto-generated shop.
- The `follows` table doesn't exist — every follow/unfollow and the Shops-page follow state errors.

- [ ] **Most urgent DB action:** paste 0004 into the Supabase SQL editor or re-run with a write-enabled MCP.

### 1.3 Anyone can insert fake "paid" orders
`orders` RLS is `insert with check (true)` and the client sets `payment_status` (`frontend/src/services/api/orders.ts:92,152`). The "pay now" flow simulates a gateway client-side and writes `payment_status: 'paid'` from the browser. Any visitor can:
- mark themselves paid,
- spam any merchant with junk orders,
- insert arbitrary totals (subtotal/total are client-supplied),
- attach items to *someone else's* order (`order_items` is also `insert with check (true)`).

- [ ] Orders should be created `pending`-only (add `with check (payment_status = 'pending')` or a trigger/RPC that recomputes totals server-side).
- [ ] Only a server-side payment callback (Edge Function / future payments backend) should ever flip an order to `paid`.

### 1.4 Any signed-in user can overwrite or delete ANY file in the `media` bucket
`0003_storage_media.sql` grants update/delete to all `authenticated` users with only a `bucket_id = 'media'` check — a free shopper account can delete every merchant's product images.

- [ ] Scope policies to the owner folder, e.g. `(storage.foldername(name))[2] = auth.uid()::text` (upload path is `<folder>/<uid>/<uuid>.<ext>`, so the uid is the second segment).

### 1.5 Plaintext Supabase personal access token in root `.env`
`sbp_…` management-level token. Not git-tracked, but sitting in plaintext in the project folder.

- [ ] Rotate it. (The MCP server isn't picking it up anyway — it reported Unauthorized.)

---

## 2. Bugs — database and order flow

- [ ] **Stock never decreases.** No trigger, RPC, or client code decrements `stock_qty` when an order is placed. Inventory and stock-status badges never reflect sales; a product with 1 unit can be ordered forever.
- [ ] **Order references don't match.** `CheckoutPage.tsx:140` and `OrderPage.tsx:147` generate a local `PS-…` reference for the shopper's order history, while `ordersApi.submitOrder/submitCartOrder` generate a *different* reference for the DB row. The reference a shopper quotes over WhatsApp won't exist in the merchant's dashboard. Generate the reference once and pass it through the draft.
- [ ] **Order writes are non-atomic.** Header insert then items insert (`orders.ts:83-107, 143-161`) — if the items insert fails you get an orphan order with a total but no lines. Wrap in a Postgres RPC.
- [ ] **Orders are fire-and-forget.** Both order pages call `persistOrder(...).catch(() => {})`. If the insert fails (offline, RLS, product deleted), the shopper thinks the order was sent, the merchant never sees it, nobody is told. At minimum log/toast on failure or retry.
- [ ] **`submitCartOrder` trusts `products[0].merchant_id`** and ignores `draft.shopSlug` — never verifies all cart items belong to one merchant. A stale/hand-crafted cart silently attributes items to the wrong shop.
- [ ] **Duplicate-slug signups die inside the trigger.** `handle_new_user` does a plain insert into `merchants`; a taken `handle` violates the unique constraint and aborts the whole auth signup with a cryptic error (frontend shows "Couldn't create your shop"). Add a uniqueness pre-check in the signup form and/or a suffix-retry in the trigger.
- [ ] **`orders.reference` is unique but `makeRef()` is weak** (`Date.now` base36 + 2 random digits) — two orders in the same millisecond window can collide; the second insert fails.
- [ ] **Public storefront "Orders" stat is always 0** for visitors: `merchantStats` counts `orders` under RLS, which hides other people's orders (`products.ts:15-21`).

---

## 3. Bugs — frontend

- [ ] **Duplicate React keys on the shopper Orders page.** Cart checkout records one `PlacedOrder` *per line item*, all sharing the same reference (`CheckoutPage.tsx:97-113`), and `order/OrdersPage.tsx:41` uses `key={o.reference}`. Multi-item orders render N cards with duplicate keys.
- [ ] **Analytics 7-day chart timezone bug.** `dayKey` buckets by UTC (`toISOString`) while day buckets are built from *local* midnight (`AnalyticsPage.tsx:19,51-57`). Kenya is UTC+3, so orders placed before 3am land on the previous day's bar.
- [ ] **PaymentSheet can hang forever.** `startMpesa`/`startPaypal` have no try/catch — a network error from the payments fetch leaves the sheet stuck on the "pending" spinner (`PaymentSheet.tsx:49-69`).
- [ ] **Hardcoded "Zawadi Styles"** (mock shop name) in the PayPal approval copy — `PaymentSheet.tsx:143` shows it to every real shop's customers.
- [ ] **WhatsApp deep links break on formatted numbers.** `deeplinks.ts` interpolates `merchant.contacts.whatsapp` raw into `wa.me/…`. A number saved as `+254 712 345 678` or `0712…` produces a broken link (dashboard Orders page normalizes with `.replace(/\D/g,"")`; the deeplinks helper doesn't, and nothing converts `07…` to `2547…`). Normalize once at signup/settings save, or in the helper.
- [ ] **Instagram/Facebook "SEND ORDER" silently drops the order message.** `ig.me`/`m.me` can't prefill text, so the composed order details are discarded — the merchant just gets an empty chat. An Instagram handle saved with `@` also breaks the URL. Consider copying the message to the clipboard before opening those channels.
- [ ] **No auth guards anywhere.** Visiting `/dashboard/*` or `/shop` signed out fires `getMerchant()`, which throws "Not signed in", leaving infinite skeletons. Add a guard/redirect-to-login wrapper.
- [ ] **Session desync.** `useAuth` persists its own copy of the session in localStorage and never listens to `supabase.auth.onAuthStateChange`. An expired/revoked Supabase session leaves the app believing you're signed in; sign-out in another tab isn't reflected.
- [ ] **Dashboard "Orders" badge counts the wrong orders.** `DashboardShell.tsx:19,68` uses `useOrderHistory` — the *shopper's own placed orders on this device* — not the merchant's received orders.
- [ ] **`useOrderStore.qty` leaks between products.** `resetDraft()` exists but is never called. Order product A with qty 5, open product B (stock 2), and the order page starts at qty 5 — the clamp only applies to increments (`OrderPage.tsx:218`).
- [ ] **ProductModal can't clear images:** on edit, removing every image falls back to `product?.images` (`ProductModal.tsx:153`), silently restoring them.
- [ ] **The "DB Synced" indicator in ProductModal is fake** — a 900ms cosmetic timer (`ProductModal.tsx:51-53,99-104`); nothing is synced until Save. Remove it or bind it to the mutation state.
- [ ] **Settings lets you save an invalid handle.** No slug validation on the Username field (uppercase/spaces accepted → broken `pulseshop.space/…` URL), no friendly handling of the unique-constraint failure, and changing the handle silently breaks previously shared links.
- [ ] **Favorites are device-local only** even for signed-in users — the `favorites` DB table from migration 0001 is completely unused. Either wire a favorites adapter (mirroring the follows pattern) or drop the table.
- [ ] **`OrderPage` "pay now" persists the stale store customer** (`persistOrder(customer, …)` at `OrderPage.tsx:307`) where CheckoutPage correctly uses `getValues()` — works only because `openPayment` saved first; fragile and inconsistent.

---

## 4. Unfinished features / dead code

- [ ] **Payments** — explicitly a placeholder (`services/api/payments.ts`); simulation auto-succeeds. Blocked on the partner's Daraja/PayPal backend. When it lands, the `paid` flip must move server-side (see §1.3).
- [ ] **"Forgot password?"** button on the login page does nothing (`LoginPage.tsx:80`) — no `resetPasswordForEmail` flow.
- [ ] **Inventory bulk-select checkboxes** have no bulk actions attached; the **notification bell** is purely decorative (`InventoryPage.tsx:150-157`).
- [ ] **Ratings/reviews:** `products.rating`, `review_count`, and `merchants.rating` exist in schema and UI but there is no reviews mechanism anywhere — everything shows 0.
- [ ] **Shopper accounts are half-wired to the DB:** follows persist, but favorites and the shopper's order history are localStorage-only — a signed-in shopper loses everything on a new device.
- [ ] **`mailer_autoconfirm` is ON** (testing convenience) — must be turned off before real users.
- [ ] **Backend deployment** intentionally omitted from `vercel.json` — fine, but revisit alongside the backend decision in §1.1.

---

## 5. Improvements worth making

- [ ] **Consolidate the two backends.** The frontend talks to Supabase directly (good, RLS-based); the Express app duplicates the same domain with the service-role key and no RLS. Recommended: keep the direct-Supabase model, rebuild `backend/` as a thin payments-and-webhooks service only (against the *real* schema), mounted as Vercel functions.
- [ ] **`frontend/tsconfig.tsbuildinfo` is tracked in git** — add to `.gitignore` and `git rm --cached` it. Also fix the `.gitignore` typo on line 10: `bakend/.env`.
- [ ] **Storage hygiene:** replaced avatars/banners are never deleted (unbounded bucket growth); no file-size or MIME restriction on uploads. Add a size cap in `uploadImage` and consider deleting the old object on replace.
- [ ] **No pagination on data fetches** — `listProducts`, `listOrders`, `listShops` fetch everything. Fine now, painful at scale; PostgREST `range()` is cheap to add.
- [ ] **No error boundary and no real 404 route** — any unknown path falls through to the `/:shopSlug` catch-all and renders "Shop not found", confusing for genuinely broken URLs.
- [ ] **Merchant deletion cascades away all order history** (`orders.merchant_id … on delete cascade`) — consider whether orders should survive as records (soft-delete merchants) for accounting.
- [ ] **Automation scripts are in good shape** (clean service-role usage, gitignored env); only gap: they trust the caller's merchant UUID — fine for admin use, never expose behind anything user-facing.
- [ ] **Frontend has zero tests**; the only tests in the repo are the backend's phantom-schema ones. Cheapest high-value coverage: order math (`discountedPrice`, cart totals, `computeAnalytics`) and checkout draft-building.
