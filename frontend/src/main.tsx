import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { registerSW } from "virtual:pwa-register";

import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "./styles/tokens.css";

import { InstallPrompt } from "@/components/layout/InstallPrompt";
import { Toaster } from "@/components/ui/Toaster";
import { useToasts } from "@/stores/toast";
import { ComponentsPage } from "@/routes/dev/ComponentsPage";
import { DashboardPlaceholder } from "@/routes/dashboard/PlaceholderPage";
import { InventoryPage } from "@/routes/dashboard/InventoryPage";
import { FavoritesPage } from "@/routes/favorites/FavoritesPage";
import { OrderPage } from "@/routes/order/OrderPage";
import { OrdersPage } from "@/routes/order/OrdersPage";
import { ProductDetailPage } from "@/routes/product/ProductDetailPage";
import { StorefrontPage } from "@/routes/storefront/StorefrontPage";

registerSW({ immediate: true });

// offline awareness: order/payment actions queue a toast when connectivity drops
window.addEventListener("offline", () =>
  useToasts.getState().push("You're offline — some actions may not work"),
);
window.addEventListener("online", () =>
  useToasts.getState().push("Back online", "success"),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StorefrontPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/order/:id" element={<OrderPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/dashboard" element={<DashboardPlaceholder title="Dashboard Overview" />} />
          <Route path="/dashboard/inventory" element={<InventoryPage />} />
          <Route path="/dashboard/orders" element={<DashboardPlaceholder title="Orders" />} />
          <Route path="/dashboard/analytics" element={<DashboardPlaceholder title="Analytics" />} />
          <Route path="/dashboard/settings" element={<DashboardPlaceholder title="Settings" />} />
          <Route path="/dev/components" element={<ComponentsPage />} />
        </Routes>
        <Toaster />
        <InstallPrompt />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
