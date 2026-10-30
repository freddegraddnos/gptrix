import { useEffect, useState } from "react";
import { setSiteLang } from "@/lib/uiLang";

export type PublicStudioLang = "en" | "sv";
const KEY = "inksimulator.public-studio-lang";

/** SSR starts in English; a visitor's explicit choice wins over browser locale. */
export function usePublicStudioLang(routeLang?: PublicStudioLang): [PublicStudioLang, (value: PublicStudioLang) => void] {
  const [lang, setLang] = useState<PublicStudioLang>(routeLang ?? "en");

  useEffect(() => {
    // An explicit Swedish URL keeps its own language, including during SSR.
    if (routeLang === "sv") return;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "en" || saved === "sv") {
        setLang(saved);
        return;
      }
    } catch { /* Private browsing may block storage. */ }
    const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
    setLang(locales.some((locale) => locale.toLowerCase().startsWith("sv")) ? "sv" : "en");
  }, [routeLang]);

  return [lang, (next) => {
    setLang(next);
    setSiteLang(next);
  }];
}