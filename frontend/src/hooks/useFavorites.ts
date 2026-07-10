import { useEffect, useRef } from "react";
import { services } from "@/services";
import { useAuth } from "@/stores/auth";
import { useFavorites } from "@/stores/favorites";
import { useToasts } from "@/stores/toast";

/**
 * Pulls a signed-in user's favorites from the server into the local (device)
 * store once per sign-in, and pushes up any local-only ids (saved as a guest
 * just before logging in, or offline). Mount once near the app root —
 * stores/favorites.ts stays the fast, always-available local cache; this
 * just keeps it caught up with the DB so favorites survive a new device.
 */
export function useFavoritesSync() {
  const userId = useAuth((s) => s.session?.id ?? null);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || syncedFor.current === userId) return;
    syncedFor.current = userId;

    (async () => {
      try {
        const remoteIds = await services.favorites.listFavorites();
        const { favorites, toggle } = useFavorites.getState();
        const localIds = new Set(favorites.map((f) => f.productId));

        for (const id of remoteIds) if (!localIds.has(id)) toggle(id);

        const remoteSet = new Set(remoteIds);
        await Promise.all(
          [...localIds]
            .filter((id) => !remoteSet.has(id))
            .map((id) => services.favorites.addFavorite(id).catch(() => {})),
        );
      } catch {
        // best-effort — local favorites still work offline
      }
    })();
  }, [userId]);
}

/** Toggles a favorite locally (instant) and mirrors the change to the server when signed in. */
export function useFavoriteToggle() {
  const toggle = useFavorites((s) => s.toggle);
  const isFavorite = useFavorites((s) => s.isFavorite);
  const userId = useAuth((s) => s.session?.id ?? null);
  const push = useToasts((s) => s.push);

  return (productId: string) => {
    const wasFavorite = isFavorite(productId);
    toggle(productId);
    if (!userId) return;
    const call = wasFavorite
      ? services.favorites.removeFavorite(productId)
      : services.favorites.addFavorite(productId);
    call.catch(() => push("Couldn't sync favorite — it's still saved on this device", "danger"));
  };
}
