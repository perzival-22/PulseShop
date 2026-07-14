/**
 * "Add to home screen", across the three environments this app actually lands
 * in — because PulseShop is shared as a link on WhatsApp and Instagram, and the
 * browser it opens in decides whether installing is even possible.
 *
 * - Chromium (Android/desktop): fires `beforeinstallprompt`, which we hold onto
 *   and replay when the user taps Install. This is the only case with a real
 *   install API.
 * - iOS Safari: has no such event and never will. Installing is a manual
 *   Share -> "Add to Home Screen", so all we can do is *show the user where*.
 *   Without that hint iOS users simply never discover the app can be installed.
 * - In-app browsers (Instagram, Facebook, TikTok...): cannot install at all,
 *   in either OS. The only useful advice is "open this in your real browser
 *   first" — telling a user inside Instagram's webview to tap Share and add to
 *   home screen sends them looking for a menu item that isn't there.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Already installed — running from the home screen, not a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS's own flag; it does not implement display-mode: standalone.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ lies and reports itself as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** A webview embedded in another app, where no install affordance exists. */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  // FBAN/FBAV = Facebook's webview; the rest identify themselves by name.
  return /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat|Pinterest|WhatsApp/i.test(
    navigator.userAgent,
  );
}

/**
 * The captured Chromium install event.
 *
 * Captured at MODULE scope, not in a component effect: `beforeinstallprompt`
 * commonly fires while the bundle is still evaluating, before React has
 * mounted anything. A listener attached inside a useEffect can therefore miss
 * it entirely — and then the Install button never appears, on precisely the
 * browsers that support installing.
 */
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // suppress Chrome's own mini-infobar; we render our own
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export const getInstallEvent = () => deferred;

export function onInstallEventChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fires Chrome's install dialog. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  // The event is single-use — Chrome will issue a fresh one if it's still installable.
  deferred = null;
  notify();
  return outcome === "accepted";
}
