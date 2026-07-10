import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { cn } from "@/lib/utils";
import type { OrderChannel } from "@/types";

const CHANNEL_CONFIG = {
  whatsapp: { Icon: WhatsAppIcon, bgClass: "bg-whatsapp", label: "WhatsApp" },
  instagram: { Icon: InstagramIcon, bgClass: "bg-instagram", label: "Instagram" },
  facebook: { Icon: FacebookIcon, bgClass: "bg-facebook", label: "Facebook" },
} satisfies Record<string, { Icon: typeof WhatsAppIcon; bgClass: string; label: string }>;

type SocialChannel = keyof typeof CHANNEL_CONFIG;

/**
 * Circular icon buttons for whichever social channels the seller actually set
 * up — callers filter `links` down to configured channels (see
 * `merchantSocialLinks` / `productInquiryLinks` in lib/deeplinks), so an
 * unset channel never renders as a dead button.
 */
export function SocialLinks({
  links,
  ariaPrefix = "Contact on",
  size = "size-11",
  iconSize = "size-5",
}: {
  links: { channel: OrderChannel; url: string }[];
  ariaPrefix?: string;
  size?: string;
  iconSize?: string;
}) {
  return (
    <>
      {links.map(({ channel, url }) => {
        const config = CHANNEL_CONFIG[channel as SocialChannel];
        if (!config) return null;
        const { Icon, bgClass, label } = config;
        return (
          <a
            key={channel}
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${ariaPrefix} ${label}`}
            className={cn(
              "flex items-center justify-center rounded-full text-white shadow-soft transition-transform active:scale-90",
              size,
              bgClass,
            )}
          >
            <Icon className={iconSize} />
          </a>
        );
      })}
    </>
  );
}
