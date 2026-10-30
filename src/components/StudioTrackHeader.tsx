import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Moon, Sun, UserRound } from "lucide-react";
import { InkSimulatorLockup } from "@/components/brand/InkSimulatorLogo";
import { Button } from "@/components/ui/button";
import { useStudioTheme } from "@/lib/studioTheme";

type Lang = "en" | "sv";

/**
 * Shared header for the public studio track: compact logo, one language
 * control, a separate studio-login action, optional low-weight theme toggle
 * and a clear back link on its own line so long labels wrap instead of clipping.
 */
export function StudioTrackHeader({ lang, onLang, back, login = true, theme = false, sticky = false, nav, action, compact = false }: {
  lang: Lang;
  onLang: (next: Lang) => void;
  back?: { to: string; label: string };
  login?: boolean;
  theme?: boolean;
  sticky?: boolean;
  nav?: ReactNode;
  action?: ReactNode;
  /** Narrow column use (e.g. login side panel): no page nav, no duplicate logo on desktop. */
  compact?: boolean;
}) {
  const sv = lang === "sv";
  const pathname = useRouterState({ select: state => state.location.pathname });
  const links = [
    { to: sv ? "/sv/for-studios" : "/for-studios", label: sv ? "För studios" : "For studios", active: pathname === (sv ? "/sv/for-studios" : "/for-studios") || pathname === (sv ? "/sv/for-studios/" : "/for-studios/") },
    { to: sv ? "/sv/studio-guide" : "/studio-guide", label: sv ? "Så fungerar det" : "How it works", active: pathname === (sv ? "/sv/studio-guide" : "/studio-guide") },
    { to: sv ? "/sv/studio-guide/setup" : "/studio-guide/setup", label: sv ? "Manual för anslutna studios" : "Manual for connected studios", active: pathname.includes("studio-guide/setup") },
  ];
  return <header className={`studio-track-header border-b border-border bg-background/95 ${sticky ? "sticky top-0 z-40 backdrop-blur" : ""}`}>
    <div className={`mx-auto grid min-h-[4.75rem] w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-4 py-2 sm:gap-x-4 sm:px-5 md:px-10 ${compact ? "" : "lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-10"}`}>
      <Link to={sv ? "/sv/for-studios" : "/for-studios"} aria-label={sv ? "InkSimulator för studios" : "InkSimulator for studios"} className={`min-w-0 ${compact ? "lg:invisible" : ""}`}>
        <InkSimulatorLockup imgClassName="studio-time-logo h-auto w-28 min-[390px]:w-[8.75rem]" />
      </Link>
      {!compact && <nav className="hidden min-w-0 items-center gap-8 lg:flex" aria-label={sv ? "Studiosidor" : "Studio pages"}>
        {nav ?? links.map(link => <Link key={link.to} to={link.to} className={`relative inline-flex min-h-11 items-center whitespace-nowrap text-[0.8125rem] ${link.active ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-accent" : "text-muted-foreground hover:text-foreground"}`}>{link.label}</Link>)}
      </nav>}
      <div className="flex max-w-[8.5rem] shrink-0 flex-wrap items-center justify-end gap-1 sm:max-w-none sm:flex-nowrap sm:gap-2">
        <div role="group" aria-label={sv ? "Välj språk" : "Choose language"} className="flex shrink-0 items-center rounded-full border border-border p-0.5">
          {(["sv", "en"] as const).map(l => {
            const full = l === "sv" ? "Svenska" : "English";
            return <Button key={l} variant="ghost" type="button" lang={l} aria-label={full} title={full} aria-pressed={lang === l} onClick={() => onLang(l)}
              className={`min-h-11 min-w-11 rounded-full px-2 font-mono text-[0.8125rem] font-normal sm:min-w-0 sm:px-3 ${lang === l ? "studio-time-language bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="sm:hidden">{l.toUpperCase()}</span><span className="hidden sm:inline">{full}</span>
            </Button>;
          })}
        </div>
        {theme && <ThemeToggle sv={sv} />}
        {login && <Link to={sv ? "/sv/artists" : "/artists"}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-3 font-mono text-[0.8125rem] text-foreground transition-colors hover:border-accent hover:bg-secondary">
          <UserRound aria-hidden className="hidden size-4 shrink-0 text-muted-foreground sm:block" /><span>{sv ? "Logga in" : "Log in"}</span>
        </Link>}
        {login && <Link to={sv ? "/sv/for-studios/interest" : "/for-studios/interest"}
          className="hidden min-h-11 shrink-0 items-center justify-center rounded-xl bg-foreground px-3 font-mono text-[0.8125rem] text-background transition-opacity hover:opacity-90 lg:inline-flex">
          {sv ? "Kom igång med din studio" : "Get started with your studio"}
        </Link>}
        {action}
      </div>
      {back && <div className="col-span-2 w-full">
        <Link to={back.to} className="inline-flex min-h-11 items-center gap-2 font-mono text-[0.8125rem] text-foreground hover:underline underline-offset-4">
          <ArrowLeft aria-hidden className="size-4 shrink-0 text-accent" /><span>{back.label}</span>
        </Link>
      </div>}
    </div>
  </header>;
}

/** Low-weight Dark/Bright toggle: one icon button, same stored preference. */
function ThemeToggle({ sv }: { sv: boolean }) {
  const [theme, pick] = useStudioTheme();
  const bright = theme === "bright";
  const label = sv ? "Ljust läge" : "Bright mode";
  return <Button variant="ghost" type="button" aria-pressed={bright} aria-label={label} title={label} onClick={() => pick(bright ? "dark" : "bright")}
    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
    {bright ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
  </Button>;
}
