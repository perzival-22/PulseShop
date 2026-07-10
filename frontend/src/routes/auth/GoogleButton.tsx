import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/BrandIcons";
import { isSupabaseConfigured } from "@/services/api/client";
import { loginWithGoogle } from "@/services/api/auth";
import { useToasts } from "@/stores/toast";

/**
 * "Continue with Google" entry point. Renders nothing against the mock
 * backend — Google OAuth only makes sense once Supabase is configured.
 * `intent` tells the /auth/callback page what to do with a brand-new user:
 * "merchant" routes to shop-setup onboarding, "shopper"/"login" resolve the
 * account as-is (shopper by default for a first-time sign-in).
 */
export function GoogleButton({
  intent,
  label,
}: {
  intent: "merchant" | "shopper" | "login";
  label: string;
}) {
  const push = useToasts((s) => s.push);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured) return null;

  const onClick = async () => {
    setLoading(true);
    try {
      await loginWithGoogle(intent);
      // Successful call redirects the browser away — nothing else to do here.
    } catch {
      push("Couldn't start Google sign-in. Please try again.", "danger");
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full rounded-full"
      onClick={onClick}
      disabled={loading}
    >
      <GoogleIcon className="size-4" />
      {loading ? "Redirecting…" : label}
    </Button>
  );
}
