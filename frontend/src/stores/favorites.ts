import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Favorite } from "@/types";

interface FavoritesState {
  favorites: Favorite[];
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
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
    }),
    { name: "pulseshop-favorites" },
  ),
);
