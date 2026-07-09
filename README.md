# PulseShop — Web App Build Plan

*Social-commerce storefront builder. Merchants create a hosted shop linked to their socials; shoppers browse and order via WhatsApp/Instagram/Facebook. A lightweight Shopify for sellers who only have a social-media bio link.*

---

## 0. What the mockups actually tell us

The seven screens decompose into **two products sharing one database**:

| Surface | Who uses it | Screens in mockups |
|---|---|---|
| **Merchant app** (private) | The seller | Inventory Dashboard, Add/Edit Product modal |
| **Storefront** (public) | The shopper | Desktop storefront, mobile storefront, product detail, place-order page |
| **Marketing site** (public) | Prospective sellers | Homepage ("Your Store. Your Link. Your Sales.") |

Every shop is one tenant. The system is **multi-tenant SaaS**: one codebase, many isolated shops.

### Inconsistencies to resolve before coding (not after)
- **Branding drift**: mockups say "BioCart", "PulseShop", and shop names "Maria's Chic Boutique" / "Zawadi Styles". Lock the platform name (PulseShop) and treat shop names as tenant data.
- **URL scheme**: the described `pulseshop@zawadistore.com` is an email format. Pick one real pattern (see Decision D1).
- **Currency/region**: ₱ (Philippines) and Ksh (Kenya) both appear. Decide single-region MVP vs multi-currency (Decision D2).
- **Order flow**: "Send Order via WhatsApp" and "Pay Now" are two flows. WhatsApp handoff is MVP; payment is later (Decision D3).

---

## Locked decisions

**D1 — Shop URL scheme: path-based** (`pulseshop.com/zawadistyles`). Shop slug resolves a tenant at the route level. Migrate to subdomains later only if merchants demand it.

**D2 — Currency: Kenyan Shillings (KES).** Kenya-first launch. Single currency stored on the shop record; no FX. This also fixes the payment choice below toward M-Pesa.

**D3 — Payments: PayPal + M-Pesa integration.** M-Pesa (Safaricom Daraja API, STK Push) is the primary rail for a Kenyan audience; PayPal covers card/diaspora buyers. Built in Phase 4. **Note the scope shift:** the moment money flows through PulseShop you inherit settlement, refunds, reconciliation, and payout logic — this is real backend work, not a plugin. The WhatsApp handoff (Phase 3) still ships first so the storefront works before payments exist; "pay now" is layered on top.

**D4 — Real-time inventory: no websockets for MVP.** Standard DB writes + refresh-on-load. Revisit only if merchants report overselling at scale.

---

## Stack

**Frontend (`/frontend`)**
- React 18 + TypeScript
- Vite + Tailwind CSS v4
- Zustand — state management (auth session, cart, UI state)
- TanStack Query — server-state / data fetching + caching
- React Router v7 — routing
- Radix UI — accessible primitives (modal, dropdown, dialog — maps directly to the Add-Product modal and filters in the mockups)

**Backend — Supabase (Option B: Supabase *is* the backend)**
- Supabase Postgres — the database + auto-generated data API the frontend calls directly via `@supabase/supabase-js`
- Supabase Auth — merchant login/session; the frontend holds the session (Zustand)
- **Row Level Security (RLS)** — the tenant-isolation boundary. Every shop-owned table gets policies scoping rows to the owner. This replaces the Node middleware layer. **See the RLS gate below — this is now your security perimeter.**
- Supabase Storage — product images (replaces separate S3)
- Supabase Edge Functions (Deno/TS) — server-only logic that must NOT run in the client: M-Pesa/PayPal webhooks, order state transitions, and anything using service-role keys
- Payment adapters live in Edge Functions: Daraja (M-Pesa STK Push) + PayPal SDK

**Automation (`/automation`)** — Python scripts/workers (see the Python section below), connecting to the same Supabase Postgres via the service-role key.

### Hosting
- **Vercel** — frontend (Vite static bundle) + the storefront SEO edge function (below). Connect the repo, auto-deploy on push.
- **Supabase** (managed cloud) — Postgres, Auth, Storage, Edge Functions.
- Python automation runs off-Vercel (a cron host / small worker / Supabase scheduled function calling out), since Vercel is not the place for long-running batch jobs.

### RLS security gate (mandatory, not optional)
With Option B, a mistake in one RLS policy leaks every shop's data — there's no server-side middleware behind it to catch the error. Treat RLS policies as production code:
- **Automated policy test suite** that runs on every migration in CI: for each table, assert that shop A's session cannot read/update/delete shop B's rows, and that anon/public sessions see only what the public storefront should.
- No migration merges without passing policy tests. This is the "test vigorously before beta" commitment, made enforceable.
- Keep the `service_role` key server-side only (Edge Functions, Python). It bypasses RLS — never ship it to the frontend bundle.

### The SEO fix (Vite + Vercel, no Node server)
A Vite SPA serves an empty HTML shell to crawlers and link-preview bots, and choosing Vercel + Supabase means there's no Node server to inject meta tags. So the storefront meta-injection moves to a **Vercel Edge Function / middleware** that intercepts `/[slug]` and product routes, fetches the shop's title/`og:image`/description from Supabase, and returns HTML with those tags filled in before the SPA hydrates. Fixes WhatsApp/IG/Facebook link previews and Google. (Alternative: prerender those routes. Do not skip this — shareable links are the product.)

---

## Repository structure

```
pulseshop/
├── frontend/                  # React 18 + TS + Vite SPA
│   ├── src/
│   │   ├── routes/            # React Router v7 route modules
│   │   │   ├── marketing/     # public homepage
│   │   │   ├── merchant/      # protected dashboard, inventory, orders, settings
│   │   │   └── storefront/    # public /[slug], product detail, place-order
│   │   ├── components/        # shared UI (Radix-based: modal, dropdown, dialog)
│   │   ├── stores/            # Zustand stores (auth, cart, ui)
│   │   ├── queries/           # TanStack Query hooks
│   │   ├── lib/               # supabase client, formatting (KES currency, wa.me links)
│   │   └── types/             # TS types generated from Supabase schema
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── api/                       # Vercel Edge Functions (frontend-adjacent)
│   └── storefront-meta.ts     # SEO meta-injection for /[slug] + product routes
│
├── supabase/                  # Supabase project (backend-as-config)
│   ├── migrations/            # SQL schema migrations (version-controlled)
│   ├── policies/              # RLS policies per table — reviewed like prod code
│   ├── functions/             # Edge Functions: mpesa-webhook, paypal-webhook, order-state
│   ├── tests/                 # RLS policy test suite (CI gate)
│   └── seed.sql
│
├── automation/                # Python — batch jobs & workers (see below)
│   ├── image_pipeline/
│   ├── bulk_import/
│   ├── reports/
│   └── requirements.txt
│
└── PulseAppPlan.md
```

*Frontend + the `api/` edge function deploy together on Vercel. Supabase is managed cloud, configured via versioned migrations/policies/functions in `/supabase`. Python automation deploys separately (cron host / worker).*

---

## Where Python earns its place

Supabase (client SDK + Edge Functions) handles the request path. Python is the right tool for **out-of-band batch and automation work** — things that run on a schedule or a queue, not on a user click. Keep it in `/automation` as standalone scripts/workers that connect to Supabase Postgres (service-role key) and Supabase Storage; do **not** put Python in the live request path.

Good fits:

1. **Product image pipeline** — merchants upload phone photos (the mockups show inconsistent, uncropped product shots). A Python worker (Pillow / `rembg`) resizes, compresses to WebP, generates thumbnails, and optionally removes backgrounds. Triggered by an upload event or run as a queue worker. This is the highest-value Python use here.
2. **Bulk product import** — a script that ingests a merchant's CSV/Excel catalog (pandas) and creates products via the API or direct DB insert. Sellers migrating from a spreadsheet will want this.
3. **Scheduled reports & digests** — nightly job that emails/WhatsApps each merchant a low-stock alert (mockups have a "Low Stock" state) and a daily orders summary. Cron + a simple script.
4. **Analytics rollups** — batch-aggregate views/orders/top-products into a summary table the dashboard reads, instead of computing heavy queries live.
5. **Data cleanup & seeding** — migration helpers, demo-shop seeding, currency/formatting backfills.

Where Python does **not** belong: request handling, auth, payment callbacks (M-Pesa/PayPal webhooks land on Supabase Edge Functions), or anything latency-sensitive. If you find yourself calling a Python service synchronously to render a page, you've put it in the wrong layer.

---

## Phase 1 — Foundation & data model *(Week 1–2)*

Goal: schema, auth, tenancy, empty app that runs.

- Core tables: `users`, `shops` (one owner → one shop for MVP), `categories`, `products`, `product_images`, `orders`, `order_items`.
- Multi-tenancy: every shop-owned row carries `shop_id`; isolation enforced by **RLS policies** (Option B), written and tested alongside each migration.
- `shops` fields from the mockups: name, handle/slug, avatar, cover image, bio, city, socials (whatsapp, instagram, facebook), currency, rating, order count.
- `products` fields: name, SKU, category, price, compare-at price (for the "-20%" discount badge), stock quantity, status (Available / Low Stock / Out of Stock — **derive from stock, don't store separately**), images, description, sizes/variants.
- Auth: merchant signup/login, session, password reset.
- Routing skeleton: marketing site, merchant app (protected), public storefront by slug (per D1).

**Exit criteria:** a seeded shop renders at its URL; a merchant can log in and see an empty dashboard.

---

## Phase 2 — Merchant app (inventory) *(Week 2–4)*

Goal: a seller can fully manage their catalog. *(Mockup screens 4 & 5.)*

- Dashboard shell: sidebar (Dashboard, Inventory, Orders, Analytics, Settings), merchant profile footer.
- Inventory table: image, name, SKU, category, price, stock-status pill, edit/delete row actions.
- Stat cards: Total Products, In Stock, Low Stock, Out of Stock (computed from the catalog).
- **Add/Edit Product modal**: image upload, name, SKU, category, price, stock quantity with +/− stepper, save/cancel. (Skip the websocket sync — D4.)
- Filter + category dropdown + search.
- Image upload pipeline to object storage; thumbnail generation.

**Exit criteria:** merchant can add, edit, delete, and categorize products; stats and status pills update correctly.

---

## Phase 3 — Public storefront *(Week 4–6)*

Goal: a shopper can browse a shop and place a WhatsApp order. *(Mockup screens 6 & 7, plus place-order.)*

- **Storefront page** (`/[slug]`): shop header (avatar, cover, bio, city, socials, stats), category filter, price-range + availability filters, sort, responsive product grid. Must work well on mobile — the mockups are mobile-first.
- **Product detail page**: image gallery/thumbnails, breadcrumb, title, price, rating/reviews, stock count, description, size/variant selector, favorite button, social "ask about this product" buttons, **Order Now** CTA.
- Favorites (client-side/local for MVP; no account needed for shoppers).
- Cart (the header shows a cart badge) — decide: single-item quick-order vs multi-item cart. *Recommendation: single-item order for MVP, cart in Phase 5.*
- **Place-order page**: order summary, buyer name + phone + notes, channel selector (WhatsApp/Instagram/Facebook), **Send Order** → composes a pre-filled message to the merchant's WhatsApp (`wa.me` deep link with order details). Persist the order as `pending` so the merchant sees it in their app.
- SEO: server-render storefronts, per-shop meta tags, shareable link previews.

**Exit criteria:** a shopper lands on a shop link, picks a product, and the merchant receives a structured WhatsApp message + a pending order in their dashboard.

---

## Phase 4 — Orders, discounts, payments *(Week 6–9)*

Goal: close the loop.

- **Merchant Orders view**: incoming orders (mockup shows an Orders nav badge), statuses (pending → confirmed → fulfilled/cancelled), buyer contact, notes.
- **Discounts**: compare-at price → auto "-20%" style badge; optional discount section per shop.
- **Payments (D3, optional/gated)**: integrate pay-now. If Kenya → M-Pesa (Daraja API); else Stripe/PayPal. Order state machine handles paid vs unpaid. *Only build this once WhatsApp-order demand is validated.*
- Notifications: email/WhatsApp to merchant on new order.

**Exit criteria:** merchant manages order lifecycle end to end; discounts render; (if built) a shopper can pay online.

---

## Phase 5 — Marketing site, onboarding, polish *(Week 9–11)*

Goal: sellers can discover, sign up, and launch unaided. *(Mockup screen 3.)*

- Marketing homepage: hero, feature sections, pricing, social proof, "Start for Free" CTA.
- Merchant onboarding wizard: create shop → set slug → add bio/socials → add first product → share link.
- Settings: profile, socials, currency, shop appearance.
- Analytics (light): views, top products, order counts.
- Multi-item cart if deferred from Phase 3.

**Exit criteria:** a new merchant self-serves from landing page to a live, shareable shop.

---

## Phase 6 — Hardening & launch *(Week 11–12)*

- **RLS penetration pass** — full audit of every table's policies before beta (your committed "test vigorously" gate); confirm the automated policy suite covers read/update/delete cross-tenant and anon access. This is the #1 risk in Option B.
- Rate limiting, input validation, image-upload abuse protection.
- Performance: image optimization, storefront load speed, DB indexing on `shop_id`/`slug`.
- Accessibility pass (contrast, touch targets, keyboard nav).
- Analytics/error monitoring; backups.
- Cross-device QA (storefronts are mobile-first).

**Exit criteria:** production-ready, monitored, secured.

---

## Cut line for a true MVP

If you need to ship in ~4 weeks instead of 12, ship only:
**Phase 1 + Phase 2 + a stripped Phase 3** (storefront + single-item WhatsApp order, no cart, no payments, no analytics, manual merchant onboarding). That is the smallest thing that delivers the core promise: *turn a social bio link into a working storefront that routes orders to WhatsApp.* Everything else is enhancement.

---

## Biggest risks

1. **Multi-tenant data leakage (elevated under Option B)** — RLS is your *only* isolation boundary; the frontend talks to Supabase directly, so a wrong policy = full exposure with nothing behind it. Mitigate with the mandatory automated policy suite in CI + the pre-beta RLS pen pass. Keep `service_role` out of the frontend bundle.
2. **Scope creep from the mockups** — websockets, dual currency, dual order flows, reviews, favorites all appear but none are load-bearing for launch. Defend the cut line.
3. **Payment/regulatory scope** — the moment money flows through PulseShop (M-Pesa/PayPal), you inherit settlement, refunds, and reconciliation. The WhatsApp-handoff MVP ships first and deliberately avoids this; add pay-now only in Phase 4.
4. **SEO/shareability** — the product lives or dies on link sharing, and a Vite SPA serves bots an empty shell. The Vercel edge meta-injection function is not optional; ship it with the storefront.
