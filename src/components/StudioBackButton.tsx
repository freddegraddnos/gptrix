import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { t, useStudioLang, type Copy } from "@/lib/studioLang";

const label: Copy = { en: "Dashboard", sv: "Panelen" };

/**
 * Always-available shortcut back to the studio dashboard, pinned to the
 * top right corner of any studio sub page.
 */
export function StudioBackButton() {
  const [lang] = useStudioLang();
  const [guideStep, setGuideStep] = useState<number | null>(null);
  useEffect(() => {
    const step = Number(sessionStorage.getItem("inksimulator.guide-return"));
    setGuideStep(Number.isInteger(step) && step >= 1 && step <= 19 ? step : null);
  }, []);
  return (
    <Link
      to="/artists/dashboard"
      search={guideStep ? { guide: String(guideStep) } : {}}
      aria-label={guideStep ? t({ en: "Back to guide", sv: "Tillbaka till guiden" }, lang) : t({ en: "Back to dashboard", sv: "Tillbaka till panelen" }, lang)}
      onClick={() => sessionStorage.removeItem("inksimulator.guide-return")}
      className="fixed right-3 top-3 z-50 inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background/95 px-3 text-[11px] font-bold uppercase tracking-widest text-accent shadow-sm backdrop-blur hover:bg-secondary"
      style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {guideStep ? t({ en: "Guide", sv: "Guiden" }, lang) : t(label, lang)}
    </Link>
  );
}
