import { useStudioTheme, type StudioTheme } from "@/lib/studioTheme";

import { tx, useUiLang } from "@/lib/uiLang";
/** Shared Dark/Bright switch used by StudioWorkspace and /for-studios. */
export function StudioThemeSwitch({ label = "Appearance", className = "", sv = false }: { label?: string; className?: string; sv?: boolean }) {
  useUiLang();
  const [theme, pickTheme] = useStudioTheme();
  return (
    <div role="group" aria-label={label} className={`flex shrink-0 items-center rounded-full border border-border p-0.5 ${className}`}>
      {(["dark", "bright"] as StudioTheme[]).map(mode => (
        <button key={mode} type="button" onClick={() => pickTheme(mode)} aria-pressed={theme === mode}
          className={`min-h-10 rounded-full px-2.5 text-[11px] transition-colors sm:px-3 sm:text-xs ${theme === mode ? "studio-time-language bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {mode === "dark" ? (sv ? tx("Mörk") : tx("Dark")) : (sv ? tx("Ljus") : tx("Bright"))}
        </button>
      ))}
    </div>
  );
}
