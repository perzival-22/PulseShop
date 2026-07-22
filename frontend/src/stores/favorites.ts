import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Favorite } from "@/types";

interface FavoritesState {
  favorites: Favorite[];
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
  /**
   * Wipe this device's favorites. Called on sign-out (see hooks/useFavorites.ts
   * useFavoritesSync). Favorites are what a shopper likes — personal data — and
   * this store persists to localStorage under a fixed key, so leaving them after
   * sign-out would show the previous account's favorites to the next person on
   * a shared device. Signed-in shoppers re-hydrate from the DB (RLS-scoped) on
   * next sign-in, so nothing is lost for them.
   */
  clear: () => void;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      isFavorite: (productId) => get().favorites.some((f) => f.productId === productId),
      toggle: (productId) =>
        set((s) =>
          s.favorites.some((f) => f.productId === productId)
            ? { favorites: s.favorites.filter((f) => f.productId !== productId) }
            : { favorites: [...s.favorites, { productId, addedAt: new Date().toISOString() }] },
        ),
      remove: (productId) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f.productId !== productId) })),
      clear: () => set({ favorites: [] }),
    }),
    { name: "pulseshop-favorites" },
  ),
);
