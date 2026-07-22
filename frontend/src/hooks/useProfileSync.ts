import { useEffect, useRef } from "react";
import { services } from "@/services";
import { useAuth } from "@/stores/auth";
import { useOrderStore } from "@/stores/order";

/**
 * Cross-device sync for the shopper's saved delivery details.
 *
 * Name/phone/address live in the account's private user_metadata (readable
 * only with the user's own JWT), so they already follow the account across
 * devices — but the checkout form prefills from the local `order` store, which
 * is cleared on sign-out (it's PII on a shared device). This seeds that store
 * from the account profile on sign-in, so a returning shopper's details are
 * prefilled on ANY device, not just the one where they last saved.
 *
 * Only seeds when the local customer is empty — a guest who typed their details
 * into a checkout they're mid-way through, then signed in, keeps what they
 * typed; we don't clobber active input with the stored profile.
 *
 * Mount once near the app root (see AppSync in main.tsx).
 */
export function useProfileSync() {
  const userId = useAuth((s) => s.session?.id ?? null);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;

    (async () => {
      try {
        const { customer } = useOrderStore.getState();
        if (customer.name.trim() || customer.phone.trim()) return; // don't clobber active input
        const profile = await services.auth.getProfile();
        if (!profile.name && !profile.phone && !profile.address) return;
        useOrderStore.getState().saveCustomer({
          name: profile.name,
          phone: profile.phone,
          // address seeds the delivery-notes field — that's how it reaches the
          // seller — but never overwrites notes the buyer already wrote.
          notes: customer.notes || profile.address,
        });
      } catch {
        // best-effort — checkout is still fillable by hand
      }
    })();
  }, [userId]);
}
