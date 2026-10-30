/**
 * Language choice for the studio workspace (Swedish / English).
 * Stored per browser and shared live between every studio surface.
 */
import { useEffect, useState } from "react";

export type StudioLang = "en" | "sv";
export type Copy = Record<StudioLang, string>;

const LANG_KEY = "inkvision.studio-lang";
const EVENT = "inkvision:studio-lang";

export const t = (strings: Copy, lang: StudioLang) => strings[lang];

export function hasSavedStudioLang(): boolean {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === "sv" || saved === "en";
  } catch {
    return false;
  }
}

export function readStudioLang(): StudioLang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "sv" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

export function setStudioLang(next: StudioLang) {
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    /* storage unavailable */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<StudioLang>(EVENT, { detail: next }));
  }
}

/** Current studio language, kept in sync across components and tabs. */
export function useStudioLang(): [StudioLang, (next: StudioLang) => void] {
  const [lang, setLang] = useState<StudioLang>("en");

  useEffect(() => {
    setLang(readStudioLang());
    const onCustom = (event: Event) => {
      const value = (event as CustomEvent<StudioLang>).detail;
      if (value === "sv" || value === "en") setLang(value);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANG_KEY) setLang(readStudioLang());
    };
    window.addEventListener(EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [lang, (next: StudioLang) => { setStudioLang(next); setLang(next); }];
}
