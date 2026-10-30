import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import studioPageProof from "@/assets/studio-page-controls-current.webp.asset.json";
import sessionPlanProof from "@/assets/session-planning-current.webp.asset.json";
import customerBookingProof from "@/assets/customer-session-booking-current.webp.asset.json";
import { STUDIO_TRIAL_PRESENTATION } from "@/lib/studioTrialPresentation";
import { StudioTrackHeader } from "@/components/StudioTrackHeader";
import { usePublicStudioLang } from "@/lib/publicStudioLang";
import { useStudioTheme } from "@/lib/studioTheme";
import {
  calculateStudioTimeValue, DEFAULT_STUDIO_TIME, parseStudioTimeNumber,
  restoreStudioTimeScenario, STUDIO_TIME_STORAGE_KEY, STUDIO_WORK_WEEKS,
  type StudioTimeField, type StudioTimeScenario,
} from "@/lib/studioTimeValue";

export type Lang = "en" | "sv";
const copy = {
  sv: {
    label: "INKSIMULATOR FÖR STUDIOS",
    heading: ["Du sköter tatuerandet,", "Vi sköter resten."],
    intro: "Uppdatera din studiosida med arbetsprover, artister och information. Ange antal sittningar och tidsbehov — kunden väljer en ledig tid via bokningslänken.",
    title: "Uppskattat tidsvärde", currency: "kr", month: "/ år",
    hours: "timmar", hour: "kr/timme", scenario: "i ditt exempel.",
    fields: { minutes: "Min/kund", clients: "Kunder/vecka", rate: "Värde/timme", stencilMinutes: "Extra min/kund", fortnoxMinutes: "Extra min/månad", leadsMinutes: "Extra min/månad" },
    help: "Ändra till dina siffror. 800 kr/timme är ett exempel.",
    basis: "Grundtiden (i snitt 15 min) är din egen uppskattning av hur många minuter per kund du sparar på att byta stencil och på oklara första dialoger. Att all admin finns på ett ställe sparar också tid.",
    notRevenue: "Uppskattat värde av frigjord arbetstid — inte nettovinst eller garanterad intäkt.",
    zero: "Ange din uppskattning. Med 0 räknas tjänsten inte in.",
    breakdown: "Uppdelning", how: "Så fungerar det för din studio", manual: "Manual för anslutna studios",
    services: "Räkna med fler tjänster", included: "Alla ingår", leads: "Leads/annonser",
    leadsHelp: "Egen arbetstid för annonser och kundanskaffning — inte annonsbudget eller garanterade nya kunder.",
    noDouble: "Räkna inte samma tid två gånger.",
    calculation: "Så räknar vi", weeks: "Arbetsveckor/år", base: "Grundtid", total: "Totalt",
    validation: "Ange ett giltigt tal som är 0 eller större.",
    trial: `Gratis provperiod under hela ${STUDIO_TRIAL_PRESENTATION.year}`,
    terms: `Ingen fast studioavgift (${STUDIO_TRIAL_PRESENTATION.fixedStudioFeeSek} SEK) och ingen provision (${STUDIO_TRIAL_PRESENTATION.commissionPercent} %) under provperioden.`,
    next: "Anmäl intresse för din studio. Vi kontaktar dig; inget konto skapas genom anmälan.",
    newStudios: "Nya studios", pageTab: "Studiosidan", sessionsTab: "Sittningsbokning",
    pageHeading: "Din studiosida, på dina villkor.",
    pageBody: "Uppdatera arbetsprover, artistpresentationer och studioinformation från panelen. Anpassa utseende och sektionernas ordning utan att skapa innehållet på nytt.",
    pageCaption: "Profil & utseende — aktuell vy med tillfällig teststudio.",
    sessionsHeading: "Du bestämmer tiden. Kunden väljer när.",
    sessionsBody: "Ange antal sittningar och minuter per sittning i ärendet. Kunden väljer bland lediga tider via länken. Exemplet visar 3 × 2 timmar = 6 timmar; en sittning är bokad.",
    planCaption: "Studions planering — 3 sittningar à 2 timmar.",
    customerCaption: "Kundens bokningsvy — 1 av 3 sittningar bokad.",
    pageAlt: "Studiosidans befintliga utseendekontroller med stilpaket, logotyp och sektionsordning i teststudion",
    planAlt: "Planera sittningar: tre sittningar på 120 minuter, mottagare och bokningslänk i testärendet",
    customerAlt: "Testkundens bokningsvy med en bekräftad sittning och återstående lediga dagar",
    guide: "Läs steg-för-steg-guiden", details: "Läs mer om alla funktioner", interest: "Anmäl intresse", demo: "Anmäl intresse", email: "Mejla oss",
  },
  en: {
    label: "INKSIMULATOR FOR STUDIOS",
    heading: ["You do the tattooing,", "We take care of the rest."],
    intro: "Update your studio page with work samples, artists and information. Set the number of sessions and time needed — the client picks an available time through the booking link.",
    title: "Estimated time value", currency: "SEK", month: "/ year",
    hours: "hours", hour: "SEK/hour", scenario: "in your scenario.",
    fields: { minutes: "Min/client", clients: "Clients/week", rate: "Value/hour", stencilMinutes: "Extra min/client", fortnoxMinutes: "Extra min/month", leadsMinutes: "Extra min/month" },
    help: "Use your own figures. 800 SEK/hour is an example.",
    basis: "Base time (avg 15min) is your own estimate of the minutes per client you save on changing stencils and unclear first brief conversations. All admin in one place also saves time.",
    notRevenue: "Estimated value of freed-up work time — not net profit or guaranteed revenue.",
    zero: "Enter your estimate. At 0 the service is not counted.",
    breakdown: "Breakdown", how: "How it works for your studio", manual: "Manual for connected studios",
    services: "Include more services", included: "All included", leads: "Leads/ads",
    leadsHelp: "Your own work time for ads and client acquisition — not ad budget or guaranteed new clients.",
    noDouble: "Do not count the same time twice.",
    calculation: "How we calculate", weeks: "Work weeks/year", base: "Base time", total: "Total",
    validation: "Enter a valid number that is 0 or greater.",
    trial: `Free trial throughout ${STUDIO_TRIAL_PRESENTATION.year}`,
    terms: `No fixed studio fee (${STUDIO_TRIAL_PRESENTATION.fixedStudioFeeSek} SEK) and no commission (${STUDIO_TRIAL_PRESENTATION.commissionPercent}%) during the trial.`,
    next: "Register your studio's interest. We will contact you; registration does not create an account.",
    newStudios: "New studios", pageTab: "Studio page", sessionsTab: "Session booking",
    pageHeading: "Your studio page, on your terms.",
    pageBody: "Update work samples, artist introductions and studio information from the panel. Adjust the appearance and section order without recreating your content.",
    pageCaption: "Profile & look — current interface with a temporary test studio.",
    sessionsHeading: "You decide the time. The client chooses when.",
    sessionsBody: "Set the session count and minutes per session in the request. The client picks from available times through the link. This example shows 3 × 2 hours = 6 hours; one session is booked.",
    planCaption: "Studio planning — 3 sessions of 2 hours.",
    customerCaption: "Client booking view — 1 of 3 sessions booked.",
    pageAlt: "Existing studio appearance controls with style packages, logo and section order in the test studio",
    planAlt: "Plan sessions: three 120-minute sessions, recipient and booking link in the test request",
    customerAlt: "Test client's booking view with one confirmed session and remaining available days",
    guide: "Read the step-by-step guide", details: "Read more about every feature", interest: "Register your interest", demo: "Register your interest", email: "Email us",
  },
};

/** `preview` renders the separate design proposal (ds-preview) without changing production. */
export function ForStudiosPage({ lang, preview = false, onPreviewLang }: { lang: Lang; preview?: boolean; onPreviewLang?: (lang: Lang) => void }) {
  const t = copy[lang];
  const [preferredLang, setLang] = usePublicStudioLang(lang);
  const [theme] = useStudioTheme();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<StudioTimeScenario>({ ...DEFAULT_STUDIO_TIME });
  const result = calculateStudioTimeValue(scenario);
  const locale = lang === "sv" ? "sv-SE" : "en-US";
  const format = (value: number, decimals = 0) => new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(value).replace(/\u00a0|\u202f/g, " ");

  useEffect(() => {
    document.documentElement.lang = lang;
    return () => { document.documentElement.lang = "en"; };
  }, [lang]);
  useEffect(() => {
    if (preview) return;
    if (lang === "en" && preferredLang === "sv") void navigate({ to: "/sv/for-studios", replace: true });
  }, [lang, preferredLang, navigate, preview]);
  useEffect(() => {
    try { setScenario(restoreStudioTimeScenario(sessionStorage.getItem(STUDIO_TIME_STORAGE_KEY))); }
    catch { /* Calculator remains usable if browser storage is blocked. */ }
  }, []);

  const heroCta = useRef<HTMLAnchorElement>(null);
  const [heroCtaHidden, setHeroCtaHidden] = useState(false);
  const [editingCalculator, setEditingCalculator] = useState(false);
  useEffect(() => {
    if (!heroCta.current) return;
    const observer = new IntersectionObserver(([entry]) => setHeroCtaHidden(!entry.isIntersecting));
    observer.observe(heroCta.current);
    return () => observer.disconnect();
  }, []);
  const interestPath = lang === "sv" ? "/sv/for-studios/interest" : "/for-studios/interest";

  const update = (patch: Partial<StudioTimeScenario>) => {
    const next = { ...scenario, ...patch };
    setScenario(next);
    try { sessionStorage.setItem(STUDIO_TIME_STORAGE_KEY, JSON.stringify(next)); }
    catch { /* Keep current figures in memory when storage is unavailable. */ }
  };
  const chooseLanguage = (next: Lang) => {
    if (preview && onPreviewLang) { onPreviewLang(next); return; }
    setLang(next);
    void navigate({ to: next === "sv" ? "/sv/for-studios" : "/for-studios" });
  };
  const field = (name: StudioTimeField) => {
    const invalid = result.errors.includes(name);
    return <div className="min-w-0" key={name}>
      <label htmlFor={`time-${name}`} className="mb-2 block text-xs leading-relaxed text-muted-foreground">{t.fields[name]}</label>
      <Input id={`time-${name}`} type="text" inputMode="decimal" autoComplete="off" value={scenario[name]}
        onChange={event => update({ [name]: event.target.value })}
        aria-invalid={invalid} aria-describedby={invalid ? `error-${name}` : undefined}
        className="h-12 min-w-0 bg-background px-2.5 font-mono text-lg md:text-lg" />
      {invalid && <p id={`error-${name}`} className="mt-2 text-xs leading-relaxed text-destructive">{t.validation}</p>}
    </div>;
  };
  const service = (name: "stencil" | "fortnox" | "leads", label: string, minutes: StudioTimeField) => <div className="border-t border-border py-3" key={name}>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <label htmlFor={`service-${name}`} className="flex min-h-11 min-w-0 cursor-pointer items-center text-sm">{label}</label>
      <Checkbox id={`service-${name}`} checked={scenario[name]} onCheckedChange={checked => update({ [name]: checked === true })} className="size-11 shrink-0" />
    </div>
    {scenario[name] && <div className="mt-2">{field(minutes)}{parseStudioTimeNumber(scenario[minutes]) === 0 && <p className="mt-2 text-xs leading-relaxed text-accent">{t.zero}</p>}{name === "leads" && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.leadsHelp}</p>}</div>}
  </div>;

  return <main className={`studio-time-page studio-visual-profile ${theme === "bright" ? "studio-bright" : ""} ${preview ? "ds-preview" : ""} min-h-screen bg-background font-mono text-foreground`} lang={lang}
    onFocusCapture={event => setEditingCalculator(event.target instanceof HTMLInputElement)}
    onBlurCapture={() => setEditingCalculator(false)}>
    <StudioTrackHeader lang={lang} onLang={chooseLanguage} sticky theme
      nav={<div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <Link to={interestPath} className="inline-flex min-h-11 items-center underline underline-offset-4">{t.newStudios}</Link>
        <Link to={lang === "sv" ? "/sv/studio-guide" : "/studio-guide"} className="inline-flex min-h-11 items-center">{lang === "sv" ? "Så fungerar det" : "How it works"}</Link>
        <Link to={lang === "sv" ? "/sv/studio-guide/setup" : "/studio-guide/setup"} className="inline-flex min-h-11 items-center underline underline-offset-4">{t.manual}</Link>
      </div>}
      action={heroCtaHidden ? <Link to={interestPath} className="btn-primary ds-header-cta hidden shrink-0 lg:inline-flex">{t.interest}<ArrowUpRight aria-hidden className="size-4 shrink-0" /></Link> : undefined} />
    <div className="mx-auto w-full max-w-7xl px-5 pb-[calc(9rem+env(safe-area-inset-bottom))] md:px-10 lg:pb-16">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(28rem,1fr)] lg:items-start lg:gap-16 lg:pt-12">
      <section className="pb-5 pt-1 lg:sticky lg:top-24 lg:pt-8">
        <p className="mb-3 text-[0.625rem] leading-relaxed">{t.label}</p>
        <h1 className="studio-time-heading max-w-[22ch] font-display text-[2.25rem] uppercase leading-[1.02] sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] min-[1400px]:text-[4.25rem]">
          <span className="block">{t.heading[0]}</span><span className="block">{t.heading[1]}</span>
        </h1>
        <p className="mt-4 max-w-xl text-xs leading-[1.75] sm:text-sm lg:mt-7 lg:text-base">{t.intro}</p>
        <div className="mt-4 max-w-xl border-l-2 border-accent pl-3">
          <p className="text-sm font-medium">{t.trial}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.terms}</p>
        </div>
        <Link ref={heroCta} to={interestPath} className="btn-primary mt-7 hidden w-full max-w-sm justify-between text-[0.9375rem] lg:flex">{t.interest}<ArrowUpRight aria-hidden className="shrink-0" /></Link>
        <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">{t.next}</p>
        <div className="mt-4 flex flex-col items-start gap-3 text-sm">
          <Link to={lang === "sv" ? "/sv/studio-guide" : "/studio-guide"} className="btn-link">{t.how}</Link>
          <Link to={lang === "sv" ? "/sv/studio-guide/setup" : "/studio-guide/setup"} className="text-xs text-muted-foreground underline underline-offset-4">{t.manual}</Link>
        </div>
      </section>
      <section aria-labelledby="time-value-heading" className="studio-time-calculator rounded-lg border border-accent bg-card px-4 pb-4 pt-5 sm:px-6 lg:p-8">
        <h2 id="time-value-heading" className="text-[0.625rem] uppercase leading-relaxed">{t.title}</h2>
        <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite" aria-atomic="true">
          <output className="studio-time-amount min-w-0 font-display text-[3.75rem] leading-none">{result.valid ? format(result.value) : "—"}</output>
          <span className="text-xs">{t.currency} {t.month}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.notRevenue}</p>
        <p className="mt-3 text-xs leading-relaxed" aria-live="polite">{result.valid ? `${format(result.hours, 1)} ${t.hours} × ${format(parseStudioTimeNumber(scenario.rate) ?? 0)} ${t.hour} ${t.scenario}` : t.validation}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">{(["minutes", "clients", "rate"] as const).map(field)}</div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.help}</p>
        <p className="mb-4 mt-2 text-xs leading-relaxed text-muted-foreground">{t.basis}</p>
        {result.valid && (scenario.stencil || scenario.fortnox || scenario.leads) && <dl className="mb-4 grid gap-1 text-xs leading-relaxed" aria-label={t.breakdown}>
          {([[t.base, result.base, true], ["Stencil Maker", result.stencil, scenario.stencil], ["Fortnox", result.fortnox, scenario.fortnox], [t.leads, result.leads, scenario.leads]] as const).filter(row => row[2]).map(([label, hours]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><dt className="min-w-0 text-muted-foreground">{label}</dt><dd className="text-right">{format(hours, 1)} {t.hours} · {format(hours * (parseStudioTimeNumber(scenario.rate) ?? 0))} {t.currency}</dd></div>)}
        </dl>}
        <details className="group border-t border-border">
          <summary className="studio-time-summary grid min-h-12 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <span className="min-w-0 text-xs leading-relaxed">{t.services} <span className="ml-1 inline-block text-[0.5rem] text-muted-foreground">{t.included}</span></span>
            <Plus aria-hidden className="size-5 shrink-0 text-accent transition-transform group-open:rotate-45" />
          </summary>
          {service("stencil", "Stencil Maker", "stencilMinutes")}
          {service("fortnox", "Fortnox", "fortnoxMinutes")}
          {service("leads", t.leads, "leadsMinutes")}
          <p className="pb-4 text-xs leading-relaxed text-muted-foreground">{t.noDouble}</p>
        </details>
        <details className="group border-t border-border">
          <summary className="studio-time-summary grid min-h-12 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <span className="min-w-0">{t.calculation}</span><Plus aria-hidden className="size-5 shrink-0 text-accent transition-transform group-open:rotate-45" />
          </summary>
          <dl className="space-y-3 pb-3 text-xs leading-relaxed">
            {[[t.weeks, String(STUDIO_WORK_WEEKS)], [t.base, `${format(result.base, 1)} ${t.hours}`], ["Stencil Maker", `${format(result.stencil, 1)} ${t.hours}`], ["Fortnox", `${format(result.fortnox, 1)} ${t.hours}`], [t.leads, `${format(result.leads, 1)} ${t.hours}`], [t.total, result.valid ? `${format(result.hours, 1)} ${t.hours} × ${format(parseStudioTimeNumber(scenario.rate) ?? 0)} ${t.hour}` : "—"]].map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><dt className="min-w-0">{label}</dt><dd className="text-right">{value}</dd></div>)}
          </dl>
          <p className="break-words pb-3 text-[0.625rem] leading-relaxed text-muted-foreground">{t.base}: {scenario.clients} × {scenario.minutes} × {STUDIO_WORK_WEEKS} / 60<br />Stencil Maker: {scenario.clients} × {scenario.stencilMinutes} × {STUDIO_WORK_WEEKS} / 60<br />Fortnox: {scenario.fortnoxMinutes} × 12 / 60<br />{t.leads}: {scenario.leadsMinutes} × 12 / 60<br />{t.total}: {t.hours} × {t.hour} = {t.currency} {t.month}</p>
        </details>
      </section>
      </div>
       <section className="mt-5 border-t border-border py-5 lg:mt-10 lg:py-8">
          <Tabs defaultValue="page">
            <TabsList className="grid h-auto w-full max-w-md grid-cols-2 gap-1 p-1">
              <TabsTrigger value="page" className="min-h-12 whitespace-normal font-mono text-sm">{t.pageTab}</TabsTrigger>
              <TabsTrigger value="sessions" className="min-h-12 whitespace-normal font-mono text-sm">{t.sessionsTab}</TabsTrigger>
            </TabsList>
            <TabsContent value="page" className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div><h2 className="font-display text-3xl uppercase leading-tight sm:text-4xl">{t.pageHeading}</h2><p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{t.pageBody}</p></div>
              <figure className="min-w-0"><img src={studioPageProof.url} alt={t.pageAlt} width={743} height={881} loading="lazy" className="mx-auto h-auto w-full max-w-lg rounded-lg border border-border" /><figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.pageCaption}</figcaption></figure>
            </TabsContent>
            <TabsContent value="sessions" className="mt-6">
              <h2 className="font-display text-3xl uppercase leading-tight sm:text-4xl">{t.sessionsHeading}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t.sessionsBody}</p>
              <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
                <figure className="min-w-0"><img src={sessionPlanProof.url} alt={t.planAlt} width={585} height={423} loading="lazy" className="h-auto w-full rounded-lg border border-border" /><figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.planCaption}</figcaption></figure>
                <figure className="min-w-0"><img src={customerBookingProof.url} alt={t.customerAlt} width={254} height={542} loading="lazy" className="mx-auto h-auto w-full max-w-[17rem] rounded-lg border border-border" /><figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.customerCaption}</figcaption></figure>
              </div>
            </TabsContent>
          </Tabs>
          <Link to={lang === "sv" ? "/sv/studio-guide" : "/studio-guide"} className="btn-link mt-6">{t.details}<ArrowUpRight aria-hidden className="size-4" /></Link>
          <div className="mt-7 hidden lg:block">
           <a href="mailto:fredrik@inksimulator.com" className="btn-link">{t.email}</a>
         </div>
      </section>
    </div>
    <div aria-hidden={editingCalculator} className={`studio-time-footer fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 transition-[opacity,transform] duration-150 motion-reduce:transition-none lg:hidden ${editingCalculator ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}>
       <div className="mx-auto max-w-7xl"><Link to={interestPath} className="btn-primary w-full justify-between whitespace-normal px-5 text-left text-[0.9375rem]">{t.demo}<ArrowUpRight aria-hidden className="shrink-0" /></Link><div className="mt-1 flex justify-center"><a href="mailto:fredrik@inksimulator.com" className="btn-link text-xs">{t.email}</a></div></div>
    </div>
  </main>;
}
