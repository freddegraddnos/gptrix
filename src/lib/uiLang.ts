/**
 * Interface language for app pages.
 *
 * Two separate choices, both remembered per browser:
 * - Site language: customer pages and public pages (shared with the public
 *   studio pages). Default: Swedish for Swedish browsers, otherwise English.
 * - Studio interface language: the studio workspace (/artists…, /studio…).
 *
 * URL strategy: indexable public studio pages have their own /sv/ URLs; app
 * pages keep one URL and follow the remembered choice. <html lang> always
 * follows the language actually shown.
 *
 * Only fixed interface text goes through tx(); customer-entered text, studio
 * names and other proper names are never translated.
 */
import { useSyncExternalStore } from "react";
import { SV } from "@/lib/i18n/sv";
import { PAINT_MENU_SV } from "@/lib/i18n/paint-menu-sv";
import { readStudioLang, hasSavedStudioLang } from "@/lib/studioLang";

export type UiLang = "en" | "sv";

export const SITE_LANG_KEY = "inksimulator.public-studio-lang";
const LEGACY_HOME_KEY = "inksimulator.public-lang";
const SITE_EVENT = "inksimulator:site-lang";
const STUDIO_EVENT = "inkvision:studio-lang";

function browserPrefersSwedish(): boolean {
  if (typeof navigator === "undefined") return false;
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
  return locales.some((l) => (l ?? "").toLowerCase().startsWith("sv"));
}

export function readSiteLang(): UiLang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(SITE_LANG_KEY) ?? localStorage.getItem(LEGACY_HOME_KEY);
    if (saved === "sv" || saved === "en") return saved;
  } catch { /* storage unavailable */ }
  return browserPrefersSwedish() ? "sv" : "en";
}

export function setSiteLang(next: UiLang) {
  try {
    localStorage.setItem(SITE_LANG_KEY, next);
    localStorage.setItem(LEGACY_HOME_KEY, next);
  } catch { /* keep for this visit */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SITE_EVENT, { detail: next }));
}

/** Studio workspace routes use the studio interface language. */
export function isStudioWorkspacePath(pathname: string): boolean {
  if (/^\/artists\/(browse|search)(\/|$)/.test(pathname)) return false;
  if (/^\/(sv\/)?artists(\/|$)/.test(pathname) || /^\/studio(\/|$)/.test(pathname)) return true;
  if (pathname === "/notifications" && typeof sessionStorage !== "undefined") {
    try { return sessionStorage.getItem("inksimulator.studio-notifications") === "1"; } catch { return false; }
  }
  return false;
}

function readStudioUiLang(): UiLang {
  if (hasSavedStudioLang()) return readStudioLang();
  return browserPrefersSwedish() ? "sv" : "en";
}

function currentLang(): UiLang {
  if (typeof window === "undefined") return "en";
  return isStudioWorkspacePath(window.location.pathname) ? readStudioUiLang() : readSiteLang();
}

// English until the app has hydrated, so server HTML and the first client
// render match; then every subscribed component re-renders in the chosen language.
let hydrated = false;
let snapshot: UiLang = "en";
const listeners = new Set<() => void>();
let wired = false;

function refresh() {
  const next = hydrated ? currentLang() : "en";
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  for (const ev of [SITE_EVENT, STUDIO_EVENT, "storage", "popstate"]) window.addEventListener(ev, refresh);
  // Client-side navigation between customer pages and the studio workspace.
  window.setInterval(refresh, 500);
}

function subscribe(cb: () => void) {
  wire();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
const getSnapshot = () => snapshot;

/** Called once after hydration (root component effect). */
export function markUiHydrated() {
  hydrated = true;
  wire();
  refresh();
}

/** Subscribe a component to the active interface language (SSR renders English). */
export function useUiLang(): UiLang {
  return useSyncExternalStore(subscribe, getSnapshot, () => "en");
}

/** Site (customer/public) language with a setter, for language switches. */
export function useSiteLang(): [UiLang, (next: UiLang) => void] {
  const lang = useSyncExternalStore<UiLang>(subscribe, () => (hydrated ? readSiteLang() : "en"), () => "en");
  return [lang, setSiteLang];
}

/**
 * Translate fixed interface text. Unknown strings stay as written.
 * Params replace {name} placeholders after translation.
 */
export function tx(text: string, params?: Record<string, string | number>): string {
  const lang = snapshot;
  let out = lang === "sv" ? (PAINT_MENU_SV[text] ?? SV[text] ?? text) : text;
  if (params) for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
