/**
 * Home-screen install prompt plumbing.
 *
 * The browser fires `beforeinstallprompt` at an arbitrary moment — usually far
 * too early to ask. We capture it, keep it around, and let the UI surface the
 * prompt once at a high-satisfaction moment (right after a first successful
 * try-on) instead of burying the requirement inside one feature's fine print.
 */

export type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SEEN_KEY = "inkvision.install.prompt.v1";
const SUCCESS_EVENT = "inkvision:tryon-success";

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    markInstallPromptSeen();
    emit();
  });
}

export function onInstallAvailabilityChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function hasSeenInstallPrompt(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markInstallPromptSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** True when there is anything useful to show (native prompt or iOS steps). */
export function canOfferInstall(): boolean {
  if (isStandalone() || hasSeenInstallPrompt()) return false;
  return !!deferred || isIOS();
}

/** Runs the native install flow. Returns false when it isn't available. */
export async function runInstallPrompt(): Promise<boolean> {
  if (!deferred) return false;
  const evt = deferred;
  deferred = null;
  emit();
  await evt.prompt();
  const choice = await evt.userChoice;
  markInstallPromptSeen();
  return choice.outcome === "accepted";
}

/** Fired by the AR camera after a first successful try-on. */
export function markTryOnSuccess() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUCCESS_EVENT));
}

export function onTryOnSuccess(fn: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SUCCESS_EVENT, fn);
  return () => window.removeEventListener(SUCCESS_EVENT, fn);
}

/** True when the browser has handed us a native install prompt we can fire. */
export function hasNativeInstallPrompt(): boolean {
  return !!deferred;
}
