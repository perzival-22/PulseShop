import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CustomerInfo {
  name: string;
  phone: string;
  notes: string;
}

type OrderChannel = "whatsapp" | "instagram" | "facebook";

interface OrderState {
  /** Size selected on the product detail page, carried into the order form. */
  selectedSize: string | null;
  qty: number;
  customer: CustomerInfo;
  /** Channel picked inline on the desktop product page — OrderPage uses this
   * as its initial selection instead of always defaulting to WhatsApp. */
  preferredChannel: OrderChannel | null;
  setSelectedSize: (size: string | null) => void;
  setQty: (qty: number) => void;
  saveCustomer: (customer: CustomerInfo) => void;
  setPreferredChannel: (channel: OrderChannel | null) => void;
  resetDraft: () => void;
  /**
   * Forget the saved customer (name/phone/notes). This is the buyer's PII, kept
   * across orders for convenience but persisted to localStorage — so it must be
   * wiped on sign-out, or the next person on a shared device sees the previous
   * shopper's name and phone prefilled at checkout. (Signed-in shoppers re-seed
   * it from their account profile; see AccountPage / useAccountProfile.)
   */
  clearCustomer: () => void;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      selectedSize: null,
      qty: 1,
      customer: { name: "", phone: "", notes: "" },
      preferredChannel: null,
      setSelectedSize: (selectedSize) => set({ selectedSize }),
      setQty: (qty) => set({ qty: Math.max(1, qty) }),
      saveCustomer: (customer) => set({ customer }),
      setPreferredChannel: (preferredChannel) => set({ preferredChannel }),
      resetDraft: () => set({ selectedSize: null, qty: 1, preferredChannel: null }),
      clearCustomer: () => set({ customer: { name: "", phone: "", notes: "" } }),
    }),
    {
      name: "pulseshop-order",
      // remember the customer for repeat orders; size/qty are per-session
      partialize: (s) => ({ customer: s.customer }),
    },
  ),
);
