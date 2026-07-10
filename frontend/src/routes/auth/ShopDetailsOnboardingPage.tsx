import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { Input } from "@/components/ui/Input";
import { completeMerchantOnboarding, getCurrentUser } from "@/services/api/auth";
import { refineShopSocials, shopDetailsFields } from "@/lib/shopDetailsSchema";
import { slugify } from "@/lib/slug";
import { useAuth } from "@/stores/auth";
import { useToasts } from "@/stores/toast";
import { AuthShell } from "./AuthShell";

const schema = z.object(shopDetailsFields).superRefine(refineShopSocials);
type FormValues = z.infer<typeof schema>;

/**
 * Post-Google "set up your shop" step. Reached from AuthCallbackPage when a
 * merchant-intent Google sign-in belongs to a brand-new account with no
 * merchant profile yet — Google can't supply shop name/slug/city/socials, so
 * we collect them here before creating the merchants row.
 */
export function ShopDetailsOnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const push = useToasts((s) => s.push);
  const setSession = useAuth((s) => s.setSession);
  const [slugEdited, setSlugEdited] = useState(false);
  const [checking, setChecking] = useState(true);

  const prefillName = (location.state as { prefillName?: string } | null)?.prefillName ?? "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { shopName: prefillName, slug: "", city: "", whatsapp: "", instagram: "", facebook: "" },
  });

  const shopName = watch("shopName");
  const slug = watch("slug");

  useEffect(() => {
    if (!slugEdited) setValue("slug", slugify(shopName));
  }, [shopName, slugEdited, setValue]);

  // Reached without a live session (e.g. direct nav) → send to login. Already
  // a merchant (e.g. re-visited after finishing setup) → skip straight in.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then((user) => {
      if (cancelled) return;
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      if (user.accountType === "merchant") {
        setSession(user);
        navigate("/dashboard/inventory", { replace: true });
        return;
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, setSession]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const user = await completeMerchantOnboarding({
        shopName: data.shopName,
        shopSlug: data.slug,
        city: data.city,
        socials: { whatsapp: data.whatsapp ?? "", instagram: data.instagram ?? "", facebook: data.facebook ?? "" },
      });
      setSession(user);
      push(`${user.shopName} is live 🎉`, "success");
      navigate("/dashboard/inventory");
    } catch {
      push("Couldn't set up your shop. Please try again.", "danger");
    }
  });

  if (checking) {
    return (
      <div className="app-surface flex min-h-dvh flex-col items-center justify-center gap-3 px-5">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthShell
      title="Set up your shop"
      subtitle="Almost there — just the shop details, then you're live."
      footer={null}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Shop name"
          placeholder="Zawadi Styles"
          error={errors.shopName?.message}
          {...register("shopName")}
        />

        <div className="space-y-1.5">
          <Input
            label="Your shop link"
            placeholder="zawadistyles"
            error={errors.slug?.message}
            {...register("slug", { onChange: () => setSlugEdited(true) })}
          />
          <p className="text-xs font-medium text-muted">
            pulseshop.space/<span className="font-bold text-primary">{slug || "yourshop"}</span>
          </p>
        </div>

        <Input label="City" placeholder="Nairobi" error={errors.city?.message} {...register("city")} />

        <div className="rounded-card border border-white/60 bg-white/50 p-4">
          <p className="text-sm font-bold text-ink">Link your socials</p>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            Orders are routed here. Link at least one — all three are welcome.
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-whatsapp text-white">
                <WhatsAppIcon className="size-4" />
              </span>
              <Input
                aria-label="WhatsApp number"
                placeholder="+254 712 345 678"
                inputMode="tel"
                error={errors.whatsapp?.message}
                {...register("whatsapp")}
              />
            </label>
            <label className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-instagram text-white">
                <InstagramIcon className="size-4" />
              </span>
              <Input aria-label="Instagram handle" placeholder="@yourhandle" {...register("instagram")} />
            </label>
            <label className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-facebook text-white">
                <FacebookIcon className="size-4" />
              </span>
              <Input aria-label="Facebook page" placeholder="yourpage" {...register("facebook")} />
            </label>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full rounded-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
          Create shop
        </Button>
      </form>
    </AuthShell>
  );
}
