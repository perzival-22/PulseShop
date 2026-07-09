import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/types";

interface AuthState {
  session: AuthUser | null;
  setSession: (session: AuthUser | null) => void;
  signOut: () => void;
}

/**
 * Holds the merchant session on the client. The login/signup pages populate it
 * from services.auth; when the real backend lands, the same store is fed by
 * Supabase Auth's session instead — pages don't change.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      signOut: () => set({ session: null }),
    }),
    { name: "pulseshop-auth" },
  ),
);
