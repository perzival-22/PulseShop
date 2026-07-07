# PulseShop — Frontend UI Build Plan (PWA)

> **How to use this document:** Feed this file to Claude Code and build the phases in order.
> This plan covers the **frontend only**. The backend is specified separately in `backend.md`.
> Until the backend exists, all data comes from a mock service layer (Section 6) so every screen is fully interactive from day one.

---

## 1. App Overview

**PulseShop** is a social-commerce Progressive Web App. Merchants get a link-in-bio storefront; customers browse products, save favorites, and order via WhatsApp/Instagram/Facebook — or pay directly in the app with **PayPal** or **M-Pesa**.

- **Customer experience:** mobile-first (phone-width layout, installable PWA).
- **Merchant dashboard:** desktop-first (≥1024px), authenticated area.
- **Currency:** KES (Kenyan Shilling) — M-Pesa is the primary local rail. Keep currency formatting in one utility so it can be made configurable later.

## 2. Repository Structure

```
PulseShop/
├── frontend/                 # ← everything in this document
│   ├── public/
│   │   ├── icons/            # PWA icons (192, 512, maskable)
│   │   └── manifest.webmanifest
│   ├── src/
│   │   ├── app/
│   │   │   ├── routes/       # one folder per screen
│   │   │   │   ├── storefront/
│   │   │   │   ├── product/
│   │   │   │   ├── favorites/
│   │   │   │   ├── order/
│   │   │   │   └── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── ui/       # primitives: Button, Badge, Input, Modal, Skeleton…
│   │   │   │   ├── product/  # ProductCard, StockBadge, SizeSelector, Gallery…
│   │   │   │   └── layout/   # MobileShell, DashboardShell, BottomNav, Sidebar
│   │   │   ├── lib/          # utils: currency, cn(), constants
│   │   │   ├── services/     # data layer (mock now, API later) — Section 6
│   │   │   ├── stores/       # favorites store, cart/order store (zustand)
│   │   │   └── types/        # Product, Merchant, Order, etc.
│   │   ├── styles/
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── backend/                  # ← see backend.md (leave empty for now except a README)
```

## 3. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | |
| Styling | Tailwind CSS v4 | design tokens as CSS variables |
| UI primitives | shadcn/ui-style components (Radix) | Dialog, Select, Tooltip |
| Icons | lucide-react | + simple brand SVGs for WhatsApp/IG/FB |
| Routing | react-router v7 | |
| State | zustand | `favoritesStore` (persisted to localStorage), `orderStore` |
| Data fetching | TanStack Query | reads through the service layer |
| PWA | vite-plugin-pwa | manifest + Workbox service worker |
| Forms | react-hook-form + zod | order form, product modal |

## 4. Design System

### 4.1 Colors (CSS variables in `styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--primary` | `#0D9488` (teal-600) | CTAs, active states, links |
| `--primary-deep` | `#0F766E` | hover, dashboard sidebar active |
| `--whatsapp` | `#25D366` | WhatsApp buttons only |
| `--instagram` | `#E4405F` | IG icon accent |
| `--facebook` | `#1877F2` | FB icon accent |
| `--favorite` | `#E11D48` (rose-600) | filled heart |
| `--success` / `--warning` / `--danger` | `#16A34A` / `#D97706` / `#DC2626` | stock statuses: Available / Low Stock / Out of Stock |
| `--surface` | `#FAFAF9` | page background |
| `--card` | `#FFFFFF` | cards |
| `--ink` / `--muted` | `#1C1917` / `#78716C` | text |

### 4.2 Typography & shape
- Font: **Plus Jakarta Sans** (self-hosted via `@fontsource` — no runtime CDN dependency for offline/PWA).
- Weights: 400 body, 600 labels, 800 headings/prices.
- Radii: cards 16px, buttons 14px, pills 999px, modal 22px.
- Shadows: soft (`0 1px 4px rgba(0,0,0,.06)`) on cards; large (`0 24px 64px rgba(0,0,0,.22)`) on modals.

### 4.3 Layout rules
- **Customer routes:** content constrained to `max-w-[430px] mx-auto`, sticky bottom nav (Home, Favorites ♥ with count badge, Orders).
- **Dashboard routes:** fluid ≥1024px, fixed 230px sidebar. Show a friendly "best viewed on desktop" notice under 1024px rather than breaking.

## 5. Types (single source of truth: `src/types/index.ts`)

```ts
type StockStatus = "available" | "low" | "out";

interface Product {
  id: string; name: string; sku: string; category: string;
  priceKes: number; discountPct: number | null;   // discount set from dashboard
  stockQty: number; status: StockStatus;
  images: string[]; sizes: string[] | null;
  rating: number; reviewCount: number; description: string;
}

interface Merchant {
  id: string; name: string; handle: string; bio: string; location: string;
  avatarUrl: string; isOnline: boolean;
  stats: { products: number; orders: number; rating: number };
  contacts: { whatsapp: string; instagram: string; facebook: string };
}

interface OrderDraft {
  productId: string; size: string | null; qty: number;
  customer: { name: string; phone: string; notes: string };
  channel: "whatsapp" | "instagram" | "facebook" | "direct";
  payment: null | { method: "mpesa" | "paypal"; status: "idle" | "pending" | "paid" | "failed" };
}

interface Favorite { productId: string; addedAt: string; }
```

## 6. Service Layer (mock-first, API-ready)

All screens read data through `src/services/` — never import mock data directly in components.

```
services/
├── index.ts          # exports the active adapter
├── types.ts          # ProductService, OrderService, PaymentService interfaces
├── mock/             # Phase 1: in-memory + localStorage, 300ms simulated latency
└── api/              # Phase 5 (after backend.md is executed): same interfaces, real HTTP
```

- `PaymentService.payWithMpesa(phone, amount)` → mock resolves `pending → paid` after 3s (simulates STK push).
- `PaymentService.payWithPaypal(amount)` → mock opens a fake approval modal then resolves `paid`.
- Mock catalog: **12 products** across 4 categories (Tops, Bottoms, Dresses, Accessories) with at least 2 `low` and 2 `out` items so badges/overlays are always visible. Use stable Unsplash URLs and **verify each returns HTTP 200** during development.

## 7. Screens

### 7.1 Merchant Storefront — `/` (mobile)
1. **Header row:** search icon button, cart/orders icon button.
2. **Merchant hero:** 80px avatar with **online indicator** (green dot, subtle pulse when `isOnline`); name, `@handle · location`; bio; **stats row** (Products / Orders / Rating); **WhatsApp chat button** (pill, `--whatsapp`).
3. **Category filter pills:** horizontally scrollable, `All` + categories. Tapping activates (teal fill) and filters the grid — animate with a 150ms fade.
4. **Product grid:** 2 columns. Each `ProductCard`: 3:4 image, heart toggle (top-right, fills `--favorite` and syncs to favorites store), name, price (show struck-through original + discounted price when `discountPct` set), **stock badge** (Available/Low Stock), **sold-out overlay** (dimmed image + "Sold Out" chip, card not clickable to order).
5. Card tap → `/product/:id`.

### 7.2 Product Detail — `/product/:id` (mobile)
1. **Header:** back, title, heart toggle + share.
2. **Gallery:** swipeable main image with **dot indicators**; **thumbnail row** below (active thumbnail gets teal ring). Dots + thumbnails stay in sync.
3. **Info block:** category breadcrumb, name + price (discount-aware), **rating row** (stars + score + review count), **stock badge** ("14 pieces available" / "Only 3 left!" / "Out of stock").
4. **Size selector:** tap to change active size (teal fill on active). Hidden when `sizes === null`.
5. **Contact icons row:** three circular icon buttons — **WhatsApp, Instagram, Facebook** — each deep-links to the merchant contact (`wa.me/…`, `ig.me/…`, `m.me/…`) with a pre-filled product message. Label underneath: "Ask about this product".
6. **Add to Favorites button:** full-width outline button with heart icon; toggles to filled state ("Saved to Favorites ♥"). 
7. **Primary CTA:** `ORDER NOW →` (teal) → `/order/:id` carrying selected size.

### 7.3 Favorites / Wishlist — `/favorites` (mobile)
- Reached via the **heart icon** in the bottom nav (shows count badge).
- Grid of favorited products reusing `ProductCard`; unfavoriting removes with a 200ms exit animation.
- Empty state: outline heart illustration + "No favorites yet" + "Browse products" button.
- Persisted in localStorage (guest) via zustand `persist` — survives refresh and works offline.

### 7.4 Order Form — `/order/:id` (mobile)
1. **Product summary card:** thumbnail, name, size · qty (qty stepper), price, edit button (returns to detail).
2. **Customer fields** (new customers): Full Name, Phone (+254 placeholder, validated), Notes (optional). Validate with zod; remember in localStorage for repeat orders.
3. **Context notice card:** channel selector (WhatsApp / Instagram / Facebook segmented control) + copy: "Your order will be sent to {merchant} via {channel}. They'll confirm stock and delivery."
4. **`SEND ORDER →`** (teal, full width): composes a pre-filled message and deep-links to the selected channel.
5. **Divider:** "— or pay now —".
6. **`COMPLETE ORDER — PAY NOW`** (dark, full width): opens a **payment sheet** (bottom drawer):
   - Method toggle: **M-Pesa** (phone input → "Check your phone for the STK prompt" pending state with spinner → success ✓ / failure retry) and **PayPal** (PayPal-branded button → mock approval → success).
   - Success state: green check animation, order reference, "Track via WhatsApp" link.
   - All payment states are UI-only in Phase 1 (mock service); real APIs land with the backend.

### 7.5 Inventory Dashboard — `/dashboard/inventory` (desktop)
1. **Sidebar (230px):** PulseShop logo block, nav — Dashboard, **Inventory (active)**, Orders (count badge), Analytics, Settings; merchant profile card pinned at bottom.
2. **Top bar:** breadcrumb + "Product Inventory" title, notification bell (dot), **`+ Add New Product`** button (opens modal).
3. **4 stat cards:** Total Products, In Stock, Low Stock, Out of Stock — icon chip + big number, colored per status.
4. **Toolbar:** search input (name/SKU/category, debounced), Filter button, Category dropdown.
5. **Data table** columns: checkbox · image · product name (+ "added X days ago") · **SKU** (mono chip) · category · price · **discount** (inline editable — click to set % via small popover; shows "—" when none; discounted rows show computed price) · **status badge** (dot + label) · stock units · **actions** (Edit ✎ opens modal pre-filled; Delete 🗑 opens confirm dialog).
6. **Pagination:** "Showing 1–10 of N" + page buttons.
7. Search, filter, discount edits, and delete all work against the mock service (optimistic updates via TanStack Query).

### 7.6 Add/Edit Product Modal (component, used by 7.5)
- Overlays dashboard with **backdrop blur** (`backdrop-blur` + dark scrim), Radix Dialog, closes on Esc/scrim.
- **Image upload dropzone:** drag-and-drop + browse; local preview thumbnails with remove ✕ (uploads are local-only until backend).
- **Form grid:** Product Name (span 2), SKU (auto-suggested), Category select, Price (KES), Discount %, Sizes tag input.
- **Stock quantity field with live ± counter**, and a **DB Synced indicator**: on every ± tap it pulses **orange "Syncing…"** for ~900ms then returns to **green "DB Synced"** — visualizing the database write confirmation (wired to the real backend sync in Phase 5).
- Footer: Cancel / **Save Product** (validates with zod; on save the table updates optimistically and toasts "Product saved").

## 8. PWA Requirements

- `manifest.webmanifest`: name "PulseShop", short_name "PulseShop", theme `#0D9488`, background `#FAFAF9`, `display: standalone`, icons 192/512 + maskable.
- Service worker (vite-plugin-pwa, `registerType: "autoUpdate"`):
  - Precache app shell; runtime cache product images (stale-while-revalidate, 60-entry cap).
  - Offline fallback: cached storefront + favorites work offline; order/payment actions queue a "You're offline" toast.
- Custom install prompt: after second visit, small banner "Add PulseShop to your home screen" (dismissable, respects `beforeinstallprompt`).
- Lighthouse PWA audit must pass (installable, offline-capable, HTTPS-ready).

## 9. Build Phases (execute in order)

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Scaffold** | repo structure, Vite + TS + Tailwind + router + PWA plugin, tokens, fonts | app boots, blank shell installs as PWA |
| **1. Design system + mocks** | ui primitives, ProductCard, StockBadge, mock service + 12 products | Storybook-style `/dev/components` route renders all primitives |
| **2. Customer flow** | Storefront → Product Detail → Favorites → Order Form (+ payment sheet mock) | full journey works on a 390px viewport, favorites persist |
| **3. Merchant dashboard** | Inventory screen + Add/Edit modal + discount editing | CRUD works against mock service, sync pulse animates |
| **4. PWA + polish** | offline caching, install prompt, page transitions, empty/loading/error states everywhere | Lighthouse PWA pass, no console errors |
| **5. API swap** | implement `services/api/` per backend.md contract | flip one import; zero component changes |

## 10. Acceptance Checklist (verify in browser before calling any phase done)

- [ ] Filter pills filter the grid and show active state
- [ ] Sold-out products show overlay and cannot be ordered
- [ ] Heart toggles everywhere stay in sync (card, detail, favorites page, nav badge)
- [ ] Size selector changes active size; selection carries into the order form
- [ ] WhatsApp/IG/FB buttons open correct deep links with pre-filled text
- [ ] SEND ORDER and PAY NOW flows both reach a success state (mocked)
- [ ] M-Pesa flow shows pending → success states; PayPal flow shows approval → success
- [ ] Dashboard: search, category filter, discount popover, edit, delete, pagination all work
- [ ] Modal: dropzone previews images; ± counter pulses orange → green
- [ ] App is installable and storefront loads offline after first visit
