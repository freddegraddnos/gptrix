import { ArrowUpRight } from "lucide-react";
import { StudioThemeSwitch } from "@/components/StudioThemeSwitch";
import { t, useStudioLang, type StudioLang } from "@/lib/studioLang";
import { POSTURE_URL } from "@/lib/studioNav";
import { StudioModules } from "@/components/StudioModules";

import { tx, useUiLang } from "@/lib/uiLang";
/** Language, theme and partner tools for the studio workspace. */
export function StudioPreferences() {
  useUiLang();
  const [lang, pickLang] = useStudioLang();
  return <div className="space-y-3">
    <StudioModules />
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
      <div><p className="text-sm font-bold">{t({ en: "Language", sv: "Språk" }, lang)}</p><p className="text-xs text-muted-foreground">{t({ en: "Used across studio mode.", sv: "Används i hela studioläget." }, lang)}</p></div>
      <div role="group" aria-label={t({ en: "Language", sv: "Språk" }, lang)} className="flex overflow-hidden rounded-md border border-border">
        {(["sv", "en"] as StudioLang[]).map(code => <button key={code} type="button" onClick={() => pickLang(code)} aria-pressed={lang === code}
          className={`px-3 py-1.5 text-xs font-bold ${lang === code ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>{code === "sv" ? tx("Svenska") : tx("English")}</button>)}
      </div>
    </section>
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
      <div><p className="text-sm font-bold">{t({ en: "Theme", sv: "Tema" }, lang)}</p><p className="text-xs text-muted-foreground">{t({ en: "Dark or Bright for every studio page.", sv: "Mörkt eller ljust på alla studiosidor." }, lang)}</p></div>
      <StudioThemeSwitch label={t({ en: "Theme", sv: "Tema" }, lang)} />
    </section>
    <a href={POSTURE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary">
      <div><p className="text-sm font-bold">{tx("Posture Pro")}</p><p className="text-xs text-muted-foreground">{t({ en: "Included with your studio account", sv: "Ingår i ditt studiokonto" }, lang)}</p></div>
      <ArrowUpRight className="size-4 text-accent" aria-hidden="true" />
    </a>
  </div>;
}
