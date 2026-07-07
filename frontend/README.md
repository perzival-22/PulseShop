# PulseShop — Frontend

Social-commerce PWA per [`../UI_design.md`](../UI_design.md). Phases 0–4 are built;
all data flows through the mock service layer (`src/services/mock/`) until the backend
from `../backend.md` lands (Phase 5 swaps the adapter in `src/services/index.ts`).

## Commands

```bash
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # type-check + production build + service worker
npm run preview    # serve the production build (http://localhost:4173)
npm run icons      # regenerate PWA icons from the inline SVG logo
node scripts/smoke.mjs      # headless acceptance checks (needs `npm run preview` running)
node scripts/verify-pwa.mjs # offline-load check + screenshots
```

> PWA behavior (service worker, install prompt, offline) only exists in the
> production build — use `npm run preview`, not `npm run dev`, to test it.

## Routes

| Route | Screen | Viewport |
|---|---|---|
| `/` | Merchant storefront | mobile |
| `/product/:id` | Product detail | mobile |
| `/favorites` | Wishlist | mobile |
| `/order/:id` | Order form + payment sheet | mobile |
| `/orders` | Order history | mobile |
| `/dashboard/inventory` | Inventory table + product modal | desktop ≥1024px |
| `/dev/components` | Component gallery (Phase 1 acceptance) | any |

## Structure

- `src/services/` — data layer; components never import mock data directly
- `src/stores/` — zustand: favorites (persisted), order draft, order history, toasts
- `src/components/ui|product|layout/` — primitives, product widgets, shells
- `src/lib/currency.ts` — single source of truth for KES formatting
- `src/styles/tokens.css` — Tailwind v4 theme tokens + animations
