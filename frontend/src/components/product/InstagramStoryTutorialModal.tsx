import { ClipboardPaste, Images, SquarePlus, Sticker } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: SquarePlus,
    title: "Start a new Story",
    body: "Open Instagram and tap the + to create a new Story.",
  },
  {
    icon: Images,
    title: "Add the downloaded photo",
    body: "Pick the image PulseShop just saved to your camera roll.",
  },
  {
    icon: Sticker,
    title: "Add the Link sticker",
    body: "Tap the sticker icon in the top bar, then choose Link.",
  },
  {
    icon: ClipboardPaste,
    title: "Paste your link & share",
    body: "Your product link is already copied — just paste it in and post.",
  },
];

export function InstagramStoryTutorialModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Posting your Story to Instagram"
      description="Instagram doesn't let apps place the link sticker for you, so this last part is a quick manual step."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex gap-3 rounded-card border border-stone-100 bg-card p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-instagram/10">
              <step.icon className="size-5 text-instagram" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Step {i + 1}</p>
              <p className="font-bold text-ink">{step.title}</p>
              <p className="mt-0.5 text-sm text-muted">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
