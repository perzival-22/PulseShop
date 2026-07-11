import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrderChannel, PaymentMethod } from "@/types";

export interface PlacedOrder {
  reference: string;
  /**
   * The order's secret access key (from place_order). For a guest this is the
   * ONLY way to look the order up again — it lives here and nowhere else on the
   * device. Optional so orders saved before this field existed still load.
   */
  accessToken?: string;
  productId: string;
  productName: string;
  image: string;
  size: string | null;
  qty: number;
  totalKes: number;
  channel: OrderChannel;
  paymentMethod: PaymentMethod | null;
  placedAt: string;
}

interface OrderHistoryState {
  orders: PlacedOrder[];
  add: (order: PlacedOrder) => void;
}

export const useOrderHistory = create<OrderHistoryState>()(
  persist(
    (set) => ({
      orders: [],
      add: (order) => set((s) => ({ orders: [order, ...s.orders] })),
    }),
    { name: "pulseshop-orders" },
  ),
);
