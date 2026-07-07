import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CustomerInfo {
  name: string;
  phone: string;
  notes: string;
}

interface OrderState {
  /** Size selected on the product detail page, carried into the order form. */
  selectedSize: string | null;
  qty: number;
  customer: CustomerInfo;
  setSelectedSize: (size: string | null) => void;
  setQty: (qty: number) => void;
  saveCustomer: (customer: CustomerInfo) => void;
  resetDraft: () => void;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      selectedSize: null,
      qty: 1,
      customer: { name: "", phone: "", notes: "" },
      setSelectedSize: (selectedSize) => set({ selectedSize }),
      setQty: (qty) => set({ qty: Math.max(1, qty) }),
      saveCustomer: (customer) => set({ customer }),
      resetDraft: () => set({ selectedSize: null, qty: 1 }),
    }),
    {
      name: "pulseshop-order",
      // remember the customer for repeat orders; size/qty are per-session
      partialize: (s) => ({ customer: s.customer }),
    },
  ),
);
