import * as Popover from "@radix-ui/react-popover";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { FacebookIcon, WhatsAppIcon, InstagramIcon } from "@/components/ui/BrandIcons";
import { productShareLinks } from "@/lib/deeplinks";
import { useToasts } from "@/stores/toast";
import type { Product } from "@/types";

/**
 * Share-this-product control. Where the native Web Share sheet is available
 * (most mobile browsers) tapping it opens that directly — one tap surfaces
 * every app the seller has installed, Instagram included, so there's nothing
 * better to build. Where it isn't (desktop) we fall back to explicit
 * Facebook/WhatsApp share links plus a copy-link action, since Instagram has
 * no web share endpoint — sellers paste the copied link into their bio or a
 * Story themselves.
 */
export function ShareMenu({
  product,
  triggerClassName,
  iconClassName = "size-5",
}: {
  product: Product;
  triggerClassName: string;
  iconClassName?: string;
}) {
  const push = useToasts((s) => s.push);
  const [open, setOpen] = useState(false);
  const links = productShareLinks(product);

  const copyLink = async () => {
    await navigator.clipboard.writeText(links.url);
    push("Link copied — paste it in your Instagram bio or story", "success");
    setOpen(false);
  };

  if (typeof navigator !== "undefined" && navigator.share) {
    const nativeShare = async () => {
      try {
        await navigator.share({ title: product.name, text: links.caption, url: links.url });
      } catch {
        /* user cancelled */
      }
    };
    return (
      <button type="button" aria-label="Share this product" onClick={nativeShare} className={triggerClassName}>
        <Share2 className={iconClassName} />
      </button>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label="Share this product" className={triggerClassName}>
          <Share2 className={iconClassName} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-60 rounded-card border border-stone-100 bg-card p-1.5 shadow-modal animate-modal-in"
        >
          <a
            href={links.facebook}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-stone-50"
          >
            <FacebookIcon className="size-4 text-facebook" />
            Share to Facebook
          </a>
          <a
            href={links.whatsapp}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-stone-50"
          >
            <WhatsAppIcon className="size-4 text-whatsapp" />
            Share to WhatsApp
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-stone-50"
          >
            <InstagramIcon className="size-4 text-instagram" />
            Copy link for Instagram
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
