import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const VISITS_KEY = "pulseshop-visits";
const DISMISSED_KEY = "pulseshop-install-dismissed";

/** Custom install banner: shows from the second visit, respects beforeinstallprompt. */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const visits = Number(localStorage.getItem(VISITS_KEY) ?? "0") + 1;
    localStorage.setItem(VISITS_KEY, String(visits));
    if (localStorage.getItem(DISMISSED_KEY) || visits < 2) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center gap-3 rounded-card bg-ink p-3.5 text-white shadow-modal animate-toast-in">
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary">
        <Download className="size-5" />
      </div>
      <p className="flex-1 text-sm font-semibold">Add PulseShop to your home screen</p>
      <button
        type="button"
        onClick={install}
        className="rounded-btn bg-white px-3 py-1.5 text-xs font-bold text-ink"
      >
        Install
      </button>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-white/60">
        <X className="size-4" />
      </button>
    </div>
  );
}
