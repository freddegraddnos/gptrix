import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronDown, ClipboardList, Eye, LayoutDashboard, Loader2, Menu, ShieldCheck, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, markIntentionalSignOut } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";
import { useNotifications } from "@/hooks/useNotifications";
import { t, useStudioLang, type Copy } from "@/lib/studioLang";
import { useStudioTheme } from "@/lib/studioTheme";
import { STUDIO_NAV, categoryOf, navItem, structuralBack, type NavItem, type NavKey, type StudioTab } from "@/lib/studioNav";
import { InkSimulatorLockup } from "@/components/brand/InkSimulatorLogo";
import { StudioThemeSwitch } from "@/components/StudioThemeSwitch";
import { studioBookingUrl } from "@/lib/studioBookingUrl";
import { StudioActionSearch } from "@/components/StudioActionSearch";
import { useStudioModules } from "@/hooks/useStudioModules";
import { studioNavVisible } from "@/lib/studioModules";

import { tx, useUiLang } from "@/lib/uiLang";
export const GUIDE_RETURN_KEY = "inksimulator.guide-return";
export const NOTICE_RETURN_KEY = "inksimulator.notice-return";
export const STUDIO_NOTICES_KEY = "inksimulator.studio-notifications";

export type StudioInfo = { name: string; handle?: string | null; approved: boolean };

const ui = {
  studioMode: { en: "Studio mode", sv: "Studioläge" },
  goTo: { en: "Go to", sv: "Gå till" },
  close: { en: "Close", sv: "Stäng" },
  customerView: { en: "View customer page", sv: "Visa kundsidan" },
  customerShort: { en: "Customer page", sv: "Kundsida" },
  copyLink: { en: "Copy booking link", sv: "Kopiera bokningslänk" },
  copied: { en: "Booking link copied", sv: "Bokningslänk kopierad" },
  language: { en: "Language", sv: "Språk" },
  theme: { en: "Theme", sv: "Tema" },
  signOut: { en: "Sign out", sv: "Logga ut" },
  published: { en: "Published studio", sv: "Publicerad studio" },
  pending: { en: "Not published", sv: "Inte publicerad" },
  guide: { en: "Setup guide", sv: "Kom igång" },
  notifications: { en: "Notifications", sv: "Aviseringar" },
  menu: { en: "Menu", sv: "Meny" },
  sections: { en: "Studio sections", sv: "Studioavdelningar" },
} satisfies Record<string, Copy>;

type Back = { label: string; onClick?: () => void; to?: string; search?: Record<string, string> } | null;

/**
 * The one page frame for every studio page: same top bar, back button,
 * title row with "Go to", category navigation and Dark/Bright theme.
 */
export function StudioShell({
  current, title, detail = false, back: backOverride, action, narrow = false,
  studio: studioProp, onSelectTab, guideStep, onReturnToGuide, onSignOut, children,
}: {
  /** Nav item this page belongs to (for detail pages: the list it belongs to). */
  current: NavKey;
  title?: string;
  /** Detail page: back goes to the `current` list. */
  detail?: boolean;
  back?: Back;
  action?: ReactNode;
  narrow?: boolean;
  studio?: StudioInfo;
  /** Provided on the dashboard: switch sections without leaving the page. */
  onSelectTab?: (tab: StudioTab) => void;
  guideStep?: number | null;
  onReturnToGuide?: () => void;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  useUiLang();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enabled } = useStudioModules();
  const visibleNav = STUDIO_NAV.map(category => ({ ...category, items: category.items.filter(item => studioNavVisible(item.key, enabled)) })).filter(category => category.items.length > 0);
  const [lang, pickLang] = useStudioLang();
  const [theme, pickTheme] = useStudioTheme();
  const { unread } = useNotifications(user?.id);
  const [open, setOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(() => categoryOf(current).key);
  const [fetched, setFetched] = useState<StudioInfo | null>(null);
  const [origin, setOrigin] = useState<{ guide: number | null; notice: boolean }>({ guide: null, notice: false });

  useEffect(() => {
    if (studioProp || !user) return;
    let active = true;
    void supabase.from("artist_profiles").select("studio_name, handle, status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (active && data) setFetched({ name: data.studio_name, handle: data.handle, approved: data.status === "approved" }); });
    return () => { active = false; };
  }, [studioProp, user]);

  useEffect(() => {
    if (onSelectTab) return; // dashboard passes its own guide state
    const step = Number(sessionStorage.getItem(GUIDE_RETURN_KEY));
    const notice = sessionStorage.getItem(NOTICE_RETURN_KEY) === window.location.pathname;
    setOrigin({ guide: Number.isInteger(step) && step >= 1 && step <= 19 ? step : null, notice });
  }, [onSelectTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const studio = studioProp ?? fetched;
  const item = navItem(current);
  const category = categoryOf(current);
  const heading = title ?? t(item.label, lang);

  useEffect(() => {
    setExpandedCategory(category.key);
  }, [category.key]);

  const clearOrigins = () => {
    sessionStorage.removeItem(GUIDE_RETURN_KEY);
    sessionStorage.removeItem(NOTICE_RETURN_KEY);
  };

  /** Open any nav item from anywhere. */
  const go = (target: NavItem) => {
    setOpen(false);
    if (target.external) { window.open(target.external, "_blank", "noopener,noreferrer"); return; }
    clearOrigins();
    if (target.key === "notifications") sessionStorage.setItem(STUDIO_NOTICES_KEY, "1");
    if (target.tab) {
      if (onSelectTab) { onSelectTab(target.tab); window.scrollTo(0, 0); }
      else void navigate({ to: "/artists/dashboard", search: { tab: target.tab } as never });
      return;
    }
    if (target.to) void navigate({ to: target.to as never });
  };

  const back: Back = (() => {
    if (backOverride !== undefined) return backOverride;
    const guide = guideStep ?? origin.guide;
    if (guide && (current !== "guide" || detail)) {
      return onReturnToGuide
        ? { label: t(ui.guide, lang), onClick: onReturnToGuide }
        : { label: t(ui.guide, lang), onClick: () => { clearOrigins(); void navigate({ to: "/artists/dashboard", search: { guide: String(guide) } as never }); } };
    }
    if (origin.notice && current !== "notifications") return { label: t(ui.notifications, lang), onClick: () => go(navItem("notifications")) };
    const target = detail ? item : structuralBack(current);
    return target ? { label: t(target.label, lang), onClick: () => go(target) } : null;
  })();

  const signOut = onSignOut ?? (() => {
    void (async () => {
      markIntentionalSignOut();
      await supabase.auth.signOut();
      void navigate({ to: "/artists" });
    })();
  });

  const copyLink = () => {
    if (!studio?.handle) return;
    void navigator.clipboard.writeText(studioBookingUrl(studio.handle));
    toast.success(t(ui.copied, lang));
  };

  const labelFor = (i: NavItem) => (
    <>{t(i.label, lang)}{i.key === "notifications" && unread > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">{unread > 9 ? "9+" : unread}</span>}{i.external && <ArrowUpRight className="ml-1 inline size-3" aria-hidden="true" />}</>
  );

  const isCurrent = (i: NavItem) => i.key === current;

  if (!hydrated) {
    return <div className="grid min-h-dvh place-items-center bg-background"><Loader2 className="size-6 animate-spin text-accent" /></div>;
  }

  const customerHref = studio?.handle && studio.approved ? `/${studio.handle}` : null;

  return <div className={`studio-visual-profile ${["skisser", "profil", "agent", "hours", "sync", "requests", "concepts"].includes(current) ? "studio-workbench" : ""} ${theme === "bright" ? "studio-bright" : ""} min-h-dvh bg-background font-mono text-foreground lg:grid lg:grid-cols-[240px_minmax(0,1fr)]`}>
    {/* Desktop sidebar: category names in text, current category expanded. */}
    <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:border-r lg:border-border" aria-label={t(ui.sections, lang)}>
      <div className="border-b border-border px-5 pb-5 pt-5">
        <InkSimulatorLockup markClassName="h-10" imgClassName="h-10 w-auto" />
        <p className="truncate font-display text-2xl uppercase leading-none">{studio?.name ?? tx("Studio")}</p>
        {studio && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {studio.approved ? <ShieldCheck className="size-3.5 text-accent" aria-hidden="true" /> : <Clock className="size-3.5" aria-hidden="true" />}
           {studio.approved ? t(ui.published, lang) : t(ui.pending, lang)}
        </p>}
        <StudioThemeSwitch label={t(ui.theme, lang)} sv={lang === "sv"} className="mt-4 w-full justify-center" />
      </div>
      <nav className="space-y-1 p-3" aria-label={t(ui.sections, lang)}>
        {visibleNav.map(cat => {
          const active = cat.key === category.key;
          const expanded = cat.key === expandedCategory;
          return <div key={cat.key}>
            <button type="button" onClick={() => setExpandedCategory(value => value === cat.key ? "" : cat.key)} aria-expanded={expanded}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left font-display text-[15px] uppercase tracking-wide transition-colors ${active ? "text-accent" : "text-foreground hover:bg-secondary"}`}>
              {t(cat.label, lang)}<ChevronDown className={`size-4 transition-transform ${expanded ? "" : "-rotate-90 text-muted-foreground"}`} aria-hidden="true" />
            </button>
            {expanded && <ul className="mb-2 ml-3 space-y-0.5 border-l border-border pl-2">
              {cat.items.map(i => <li key={i.key}>
                <button type="button" onClick={() => go(i)} aria-current={isCurrent(i) ? "page" : undefined}
                  className={`flex w-full items-center rounded-md px-3 py-2 text-left text-xs transition-colors ${isCurrent(i) ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-secondary"}`}>
                  {labelFor(i)}
                </button>
              </li>)}
            </ul>}
          </div>;
        })}
      </nav>
    </aside>

    <div className="min-w-0 pb-24 lg:pb-0">
      {/* Top bar: back left, customer page + account right. Identical on every page. */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex h-14 items-center justify-between gap-3 border-b border-border px-4 lg:hidden">
          <InkSimulatorLockup markClassName="h-8" imgClassName="h-8 w-auto max-w-[8.5rem]" />
          <StudioThemeSwitch label={t(ui.theme, lang)} sv={lang === "sv"} />
        </div>
        <div className="flex h-14 items-center gap-2 px-4 lg:px-8">
          <div className="min-w-0 flex-1">
            {back && <Button type="button" variant="ghost" size="sm" onClick={back.onClick} className="-ml-2 h-9 max-w-full gap-1.5 rounded-md px-2 text-xs font-bold text-accent hover:text-accent">
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{back.label}</span>
            </Button>}
          </div>
          {customerHref ? <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 rounded-md text-xs">
            <a href={customerHref} target="_blank" rel="noopener noreferrer"><Eye className="size-4" aria-hidden="true" /><span className="hidden sm:inline">{t(ui.customerView, lang)}</span><span className="sm:hidden">{t(ui.customerShort, lang)}</span></a>
          </Button> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-9 max-w-[9rem] shrink-0 gap-1 rounded-md px-2 text-xs sm:max-w-[14rem]">
                <span className="truncate font-bold">{studio?.name ?? tx("Studio")}</span><ChevronDown className="size-4 shrink-0" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={`${theme === "bright" ? "studio-bright" : ""} w-56`}>
              {studio?.handle && <DropdownMenuItem onSelect={copyLink}>{t(ui.copyLink, lang)}</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground">{t(ui.language, lang)}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => pickLang("sv")}>{lang === "sv" ? "✓ " : ""}{tx("Svenska")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => pickLang("en")}>{lang === "en" ? "✓ " : ""}{tx("English")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground">{t(ui.theme, lang)}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => pickTheme("dark")}>{theme === "dark" ? "✓ " : ""}{tx("Dark")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => pickTheme("bright")}>{theme === "bright" ? "✓ " : ""}{tx("Bright")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>{t(ui.signOut, lang)}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Tablet: categories as text tabs. */}
        <nav className="hidden overflow-x-auto border-t border-border px-4 sm:flex lg:hidden" aria-label={t(ui.sections, lang)}>
          {visibleNav.map(cat => <button key={cat.key} type="button" onClick={() => setExpandedCategory(cat.key)} aria-expanded={expandedCategory === cat.key} aria-current={cat.key === category.key ? "true" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2.5 font-display text-sm uppercase tracking-wide ${cat.key === category.key ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t(cat.label, lang)}
          </button>)}
        </nav>
      </header>

      <main className={`mx-auto w-full ${narrow ? "max-w-3xl" : "max-w-6xl"} px-4 py-6 lg:px-8 lg:py-8`}>
        {current === "oversikt" && !detail && <StudioActionSearch lang={lang === "sv" ? "sv" : "en"} onOpen={key => go(navItem(key))} isVisible={key => studioNavVisible(key, enabled)} />}
        {/* Title row: eyebrow, Anton heading, Go to, one main action. */}
        <div className="relative mb-6">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t(category.label, lang)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="studio-heading min-w-0 font-display text-3xl uppercase leading-none lg:text-4xl">{heading}</h1>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="studio-goto"
              className="h-9 gap-1.5 rounded-full px-4 text-xs font-bold">
              {t(ui.goTo, lang)}<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </Button>
            {action && <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div>}
          </div>
          {/* Tablet: pages within the category. */}
          {(visibleNav.find(cat => cat.key === expandedCategory)?.items.length ?? 0) > 1 && <div className="mt-4 hidden flex-wrap gap-1.5 sm:flex lg:hidden">
            {visibleNav.find(cat => cat.key === expandedCategory)?.items.map(i => <button key={i.key} type="button" onClick={() => go(i)} aria-current={isCurrent(i) ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs ${isCurrent(i) ? "border-accent bg-accent text-accent-foreground" : "border-border text-foreground hover:bg-secondary"}`}>{labelFor(i)}</button>)}
          </div>}

          {open && <>
            <button type="button" aria-label={t(ui.close, lang)} onClick={() => setOpen(false)} className="fixed inset-0 z-40 hidden cursor-default sm:block" />
            <div id="studio-goto" role="dialog" aria-label={t(ui.goTo, lang)}
              className="studio-goto fixed inset-0 z-50 overflow-y-auto bg-background p-5 sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:mt-2 sm:w-[min(760px,calc(100vw-2rem))] sm:rounded-lg sm:border sm:border-border sm:shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-display text-xl uppercase">{t(ui.goTo, lang)}</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="gap-1.5 text-xs"><X className="size-4" aria-hidden="true" />{t(ui.close, lang)}</Button>
              </div>
              <nav className="grid grid-cols-1 gap-x-10 gap-y-6 min-[420px]:grid-cols-2 sm:grid-cols-3" aria-label={t(ui.sections, lang)}>
                {visibleNav.map(cat => <div key={cat.key}>
                  <p className={`mb-1.5 font-display text-sm uppercase tracking-wide ${cat.key === category.key ? "text-accent" : "text-muted-foreground"}`}>{t(cat.label, lang)}</p>
                  <ul className="space-y-0.5">
                    {cat.items.map(i => <li key={i.key}>
                      <button type="button" onClick={() => go(i)} aria-current={isCurrent(i) ? "page" : undefined}
                        className={`min-h-10 w-full rounded-md px-3 py-2 text-left text-sm ${isCurrent(i) ? "bg-foreground text-background" : "hover:bg-secondary"}`}>{labelFor(i)}</button>
                    </li>)}
                  </ul>
                </div>)}
              </nav>
            </div>
          </>}
        </div>
        {children}
      </main>

      {/* Phone: four labeled shortcuts. */}
      <nav aria-label={t(ui.sections, lang)} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden">
        {([["oversikt", LayoutDashboard], ["bokningar", ClipboardList], ["kalender", CalendarDays]] as const).filter(([key]) => studioNavVisible(key, enabled)).map(([key, Icon]) => {
          const i = navItem(key);
          const active = categoryOf(current).key === categoryOf(key).key && !open;
          return <button key={key} type="button" onClick={() => go(i)} aria-current={current === key ? "page" : undefined}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-accent" : "text-muted-foreground"}`}>
            <Icon className="size-5" aria-hidden="true" />{t(categoryOf(key).label, lang)}
          </button>;
        })}
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="studio-goto"
          className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${open ? "text-accent" : "text-muted-foreground"}`}>
          <Menu className="size-5" aria-hidden="true" />{t(ui.menu, lang)}
        </button>
      </nav>
    </div>
  </div>;
}
