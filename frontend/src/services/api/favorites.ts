import type { FavoritesService } from "../types";
import { requireUserId, supabase } from "./client";

/**
 * Server sync for a signed-in user's favorites (migration 0001's `favorites`
 * table, RLS owner-only). Mirrors follows.ts — see stores/favorites.ts and
 * hooks/useFavorites.ts for how this layers under the local device cache.
 */
export const favoritesApi: FavoritesService = {
  async listFavorites(): Promise<string[]> {
    const uid = await requireUserId();
    const { data, error } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", uid);
    if (error) throw error;
    return (data as { product_id: string }[]).map((r) => r.product_id);
  },

  async addFavorite(productId: string): Promise<void> {
    const uid = await requireUserId();
    const { error } = await supabase
      .from("favorites")
      .upsert({ user_id: uid, product_id: productId });
    if (error) throw error;
  },

  async removeFavorite(productId: string): Promise<void> {
    const uid = await requireUserId();
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", uid)
      .eq("product_id", productId);
    if (error) throw error;
  },
};
