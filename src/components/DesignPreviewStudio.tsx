import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronUp, FileText, Loader2, MessageSquareMore, Sprout, UserRound, Users } from "lucide-react";
import { InkSimulatorLockup } from "@/components/brand/InkSimulatorLogo";
import { Checkbox } from "@/components/ui/checkbox";
import { sendStudioInterest } from "@/lib/studioInterest.functions";
import { studioInterestSchema } from "@/lib/studioInterest.schema";
import {
  calculateStudioTimeValue, DEFAULT_STUDIO_TIME, parseStudioTimeNumber, restoreStudioTimeScenario,
  STUDIO_TIME_STORAGE_KEY, STUDIO_WORK_WEEKS, type StudioTimeField, type StudioTimeScenario,
} from "@/lib/studioTimeValue";

/** Swedish design proposal pages (reference images 2026-10-11), preview only. */
type Active = "studios" | "how" | "start";
const P = { studios: "/design-preview/sv/for-studios", how: "/design-preview/sv/sa-fungerar-det", interest: "/design-preview/sv/interest" } as const;

function Shell({ active, cta = false, children }: { active: Active; cta?: boolean; children: ReactNode }) {
  useEffect(() => { document.documentElement.lang = "sv"; return () => { document.documentElement.lang = "en"; }; }, []);
  const nav = (key: Active, label: string, to: string) => <Link to={to} className={`whitespace-nowrap border-b-2 pb-2 pt-2 text-[0.9375rem] ${active === key ? "border-accent text-foreground" : "border-transparent text-foreground/90 hover:text-foreground"}`}>{label}</Link>;
  return <main lang="sv" className="studio-time-page ds-preview min-h-screen bg-background font-mono text-foreground">
    <header className="mx-auto flex w-full flex-wrap items-center gap-x-8 gap-y-3 px-5 py-5 md:px-10" style={{ maxWidth: "88rem" }}>
      <Link to={P.studios} aria-label="InkSimulator" className="shrink-0"><InkSimulatorLockup imgClassName="studio-time-logo h-auto w-[7.5rem]" /></Link>
      <nav className="order-3 flex w-full gap-6 overflow-x-auto lg:order-none lg:w-auto lg:gap-9">
        {nav("studios", "För studios", P.studios)}{nav("how", "Så fungerar det", P.how)}{nav("start", "Kom igång", "/sv/studio-guide/setup")}
      </nav>
      <div className="ml-auto flex items-center gap-3 lg:gap-6">
        <div role="group" aria-label="Välj språk" className="flex items-center rounded-full border border-border p-1">
          <span aria-current="true" className="rounded-full bg-secondary px-4 py-2 text-sm">Svenska</span>
          <Link to="/design-preview/for-studios" search={{ lang: "en" }} className="rounded-full px-4 py-2 text-sm text-foreground/90">English</Link>
        </div>
        <span aria-hidden className="hidden h-10 w-px bg-border lg:block" />
        <Link to="/sv/artists" className="btn-secondary hidden min-h-12 sm:inline-flex"><UserRound aria-hidden className="size-4" />Studioinloggning</Link>
        {cta && <Link to={P.interest} className="btn-primary hidden min-h-12 sm:inline-flex">Anmäl intresse</Link>}
      </div>
    </header>
    {children}
  </main>;
}

export function ForStudiosProposal() {
  const [s, setS] = useState<StudioTimeScenario>({ ...DEFAULT_STUDIO_TIME });
  const [open, setOpen] = useState(true);
  const [calc, setCalc] = useState(false);
  const r = calculateStudioTimeValue(s);
  const f = (v: number, d = 0) => new Intl.NumberFormat("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace(/\u00a0|\u202f/g, " ");
  useEffect(() => { try { setS(restoreStudioTimeScenario(sessionStorage.getItem(STUDIO_TIME_STORAGE_KEY))); } catch { /* storage blocked */ } }, []);
  const up = (patch: Partial<StudioTimeScenario>) => { const n = { ...s, ...patch }; setS(n); try { sessionStorage.setItem(STUDIO_TIME_STORAGE_KEY, JSON.stringify(n)); } catch { /* memory only */ } };
  const rate = f(parseStudioTimeNumber(s.rate) ?? 0);
  const input = (name: StudioTimeField, label: string) => <div key={name} className="min-w-0">
    <label htmlFor={`p-${name}`} className="mb-2 block text-sm">{label}</label>
    <input id={`p-${name}`} inputMode="decimal" autoComplete="off" value={s[name]} aria-invalid={r.errors.includes(name)} onChange={e => up({ [name]: e.target.value })}
      className="field-input h-14 bg-background font-mono text-xl" />
  </div>;
  const services = [["stencil", "Stencil Maker", "stencilMinutes", "Extra min/kund"], ["fortnox", "Fortnox", "fortnoxMinutes", "Extra min/månad"], ["leads", "Leads/annonser", "leadsMinutes", "Extra min/månad"]] as const;
  return <Shell active="studios">
    <div className="mx-auto w-full px-5 pb-28 md:px-10 lg:pb-16" style={{ maxWidth: "88rem" }}>
      <div className="grid gap-10 pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(26rem,0.9fr)] lg:gap-14 lg:pt-14">
        <section>
          <p className="text-sm tracking-[0.12em]">INKSIMULATOR FÖR STUDIOS</p>
          <h1 className="ds-glow-strong mt-6 font-display text-5xl uppercase leading-[1] sm:text-6xl xl:text-[5.25rem]">Du sköter tatuerandet,<br />vi sköter resten.</h1>
          <p className="mt-8 max-w-xl text-base leading-[1.75] sm:text-lg">Låt kunden prova motivet före besöket. Samla idéer, skisser och bokningar på ett ställe. Lägg mer av dagen på ditt hantverk.</p>
          <div className="mt-10 flex flex-wrap items-center gap-8">
            <Link to={P.interest} style={{ background: "var(--accent)", color: "var(--foreground)" }} className="inline-flex min-h-14 w-full max-w-sm items-center justify-between ds-accent-btn rounded-xl bg-accent px-7 text-base font-medium text-foreground sm:w-96">Anmäl intresse<ArrowRight aria-hidden className="size-5" /></Link>
            <Link to={P.how} className="btn-link border-b border-accent text-base no-underline">Så fungerar det<ArrowRight aria-hidden className="size-4" /></Link>
          </div>
        </section>
        <section aria-labelledby="p-value" className="ds-card self-start border border-accent/60 bg-card/60 p-6 sm:p-11">
          <h2 id="p-value" className="text-sm tracking-[0.06em]">VÄRDET AV DIN FRIGJORDA TID</h2>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-5" aria-live="polite">
            <output className="font-display text-7xl leading-none sm:text-8xl">{r.valid ? f(r.value) : "—"}</output><span className="text-lg">kr / år</span>
          </div>
          <p className="mt-4 text-base">{r.valid ? `${f(r.hours, 1)} timmar × ${rate} kr/timme i ditt exempel.` : "Ange ett giltigt tal som är 0 eller större."}</p>
          <div className="mt-8 grid grid-cols-3 gap-4">{input("minutes", "Min/kund")}{input("clients", "Kunder/vecka")}{input("rate", "Värde/timme")}</div>
          <p className="mt-4 text-sm text-muted-foreground">Ändra till dina siffror.</p>
          <div className="mt-6 border-t border-border">
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left">
              <span className="text-base">Räkna med fler tjänster <span className="ml-6 text-sm text-muted-foreground">Alla ingår</span></span>
              {open ? <ChevronUp aria-hidden className="size-5 text-accent" /> : <ChevronDown aria-hidden className="size-5 text-accent" />}
            </button>
            {open && <div className="pb-5">
              <div className="flex flex-wrap gap-x-7 gap-y-3">{services.map(([k, l]) => <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
                <Checkbox checked={s[k]} onCheckedChange={c => up({ [k]: c === true })} className="size-7 rounded-md" />{l}</label>)}</div>
              {services.filter(([k]) => s[k]).map(([k, l, m, ml]) => <div key={k} className="mt-4">{input(m, `${l} · ${ml}`)}</div>)}
            </div>}
          </div>
          <div className="border-t border-border">
            <button type="button" aria-expanded={calc} onClick={() => setCalc(!calc)} className="grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] items-center text-left text-base">
              Så räknar vi{calc ? <ChevronUp aria-hidden className="size-5 text-accent" /> : <ChevronDown aria-hidden className="size-5 text-accent" />}
            </button>
            {calc && <dl className="space-y-3 pb-3 text-sm">{[["Arbetsveckor/år", String(STUDIO_WORK_WEEKS)], ["Grundtid", `${f(r.base, 1)} timmar`], ["Stencil Maker", `${f(r.stencil, 1)} timmar`], ["Fortnox", `${f(r.fortnox, 1)} timmar`], ["Leads/annonser", `${f(r.leads, 1)} timmar`], ["Totalt", r.valid ? `${f(r.hours, 1)} timmar × ${rate} kr/timme` : "—"]].map(([a, b]) => <div key={a} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><dt>{a}</dt><dd>{b}</dd></div>)}</dl>}
          </div>
        </section>
      </div>
      <ul className="mt-14 grid gap-6 border-t border-border pt-10 md:grid-cols-3 md:gap-0">
        {[[Users, "Bättre förberedda kunder"], [CalendarDays, "Bokningar på ett ställe"], [FileText, "Mindre administration"]].map(([Icon, label], i) => {
          const I = Icon as typeof Users;
          return <li key={label as string} className={`flex items-center gap-8 md:justify-center ${i ? "md:border-l md:border-border" : "md:justify-start"}`}><I aria-hidden strokeWidth={1.4} className="size-12 shrink-0 text-accent" /><span className="text-lg">{label as string}</span></li>;
        })}
      </ul>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
      <Link to={P.interest} style={{ background: "var(--accent)", color: "var(--foreground)" }} className="flex min-h-12 w-full items-center justify-between ds-accent-btn rounded-xl bg-accent px-5 text-[0.9375rem] font-medium text-foreground">Anmäl intresse<ArrowRight aria-hidden className="size-5" /></Link>
    </div>
  </Shell>;
}

const chapters = ["Få förfrågningar", "Förbered tatueringen", "Planera och boka", "Administrera studion"];
const steps = ["Kunden skickar sin idé", "Ni diskuterar motivet", "Kunden väljer tid", "Du förbereder besöket"];

export function HowItWorksProposal() {
  const [active, setActive] = useState(0);
  const tile = (children: ReactNode, big = false) => <div className={`grid place-items-center rounded-2xl border border-accent/50 bg-background/40 text-accent ${big ? "size-28" : "size-24"}`}>{children}</div>;
  return <Shell active="how" cta>
    <div className="mx-auto grid w-full gap-10 px-5 pb-16 pt-6 md:px-10 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-12 lg:pt-14" style={{ maxWidth: "88rem" }}>
      <aside className="lg:border-r lg:border-border lg:pr-6">
        <p className="mb-6 text-base">I den här guiden</p>
        <ol className="flex gap-2 overflow-x-auto lg:block lg:space-y-3">{chapters.map((c, i) => <li key={c} className="shrink-0">
          <button type="button" onClick={() => setActive(i)} aria-current={active === i ? "step" : undefined} className={`flex min-h-16 w-full items-center gap-6 whitespace-nowrap rounded-lg border-l-4 px-5 text-left text-base ${active === i ? "border-accent bg-secondary/70 text-accent" : "border-transparent"}`}>
            <span className="text-accent">{String(i + 1).padStart(2, "0")}</span>{c}</button>
        </li>)}</ol>
      </aside>
      <section className="min-w-0">
        <h1 className="ds-glow-soft font-display text-5xl uppercase leading-[1] sm:text-6xl xl:text-7xl">Så fungerar det i din studio</h1>
        <p className="mt-3 text-lg">Från första idé till bokad tid.</p>
        <ol className="mt-10 grid grid-cols-4">{steps.map((s, i) => <li key={s} className="relative flex flex-col items-center text-center">
          {i > 0 && <span aria-hidden className="absolute right-1/2 top-6 h-px w-[calc(100%-3.5rem)] -translate-x-7 bg-accent/60" />}
          <span className={`relative grid size-12 place-items-center rounded-full border border-accent text-base ${i === active ? "bg-accent" : ""}`}>{i + 1}</span>
          <span className="mt-3 max-w-[10rem] text-sm leading-relaxed sm:text-base">{s}</span>
        </li>)}</ol>
        <div className="mt-8 space-y-3">{chapters.map((c, i) => active === i
          ? <article key={c} className="ds-card grid gap-6 border border-accent/60 bg-card/60 p-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div>
                <p className="text-sm">{String(i + 1).padStart(2, "0")} / {c.toUpperCase()}</p>
                {i === 0 && <><h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl" style={{ textTransform: "none" }}>Börja med kundens idé.</h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed">Samla motiv, referenser och önskemål i en förfrågan. Fortsätt dialogen på ett ställe.</p></>}
                <Link to="/sv/studio-guide" className="mt-5 inline-flex items-center gap-2 border-b border-accent pb-1 text-base">Visa detaljer<ArrowDown aria-hidden className="size-4" /></Link>
              </div>
              {i === 0 && <div aria-hidden className="hidden items-center gap-3 sm:flex">
                {tile(<MessageSquareMore strokeWidth={1.4} className="size-16" />)}<span className="text-accent">----</span>
                {tile(<Sprout strokeWidth={1} className="size-20 text-foreground" />, true)}<span className="text-accent">----</span>
                {tile(<CalendarDays strokeWidth={1.4} className="size-16" />)}
              </div>}
            </article>
          : <button key={c} type="button" onClick={() => setActive(i)} className="grid min-h-16 w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center rounded-xl border border-border bg-card/40 px-9 text-left text-base">
              <span className="text-accent">{String(i + 1).padStart(2, "0")}</span>{c}<ChevronDown aria-hidden className="size-5 text-accent" />
            </button>)}</div>
        <p className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-border pt-8 text-base">Har du redan ett studiokonto?
          <Link to="/sv/studio-guide/setup" className="inline-flex items-center gap-2 border-b border-accent pb-1 text-accent">Öppna kom igång-guiden<ArrowRight aria-hidden className="size-4" /></Link></p>
      </section>
    </div>
  </Shell>;
}

type Field = "studioName" | "contactName" | "email" | "phone";
const fields: [Field, string, string][] = [["studioName", "Studionamn", "Din studio"], ["contactName", "Kontaktperson", "Ditt namn"], ["email", "E-post", "du@studio.se"], ["phone", "Telefonnummer", "+46"]];

export function InterestProposal() {
  const submitInterest = useServerFn(sendStudioInterest);
  const [form, setForm] = useState<Record<Field, string>>({ studioName: "", contactName: "", email: "", phone: "" });
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const data = { ...form, website };
    if (!studioInterestSchema.safeParse(data).success) { setError("Fyll i alla fält med giltiga kontaktuppgifter."); return; }
    setBusy(true);
    try { const res = await submitInterest({ data }); if (!res.ok) throw new Error("not sent"); setSent(true); }
    catch { setError("Vi kunde inte skicka din förfrågan. Försök igen eller mejla oss direkt."); }
    finally { setBusy(false); }
  };
  return <Shell active="studios">
    <div className="mx-auto grid w-full gap-10 px-5 pb-16 pt-6 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.95fr)] lg:gap-20 lg:pt-14" style={{ maxWidth: "88rem" }}>
      <section>
        <p className="text-base tracking-[0.06em]">FÖR STUDIOS</p>
        <h1 className="ds-glow-strong mt-6 font-display text-5xl uppercase leading-[1] sm:text-6xl xl:text-[5.5rem]">Låt oss prata<br />om din studio.</h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed">Lämna dina uppgifter så kontaktar vi dig om hur InkSimulator kan passa din studio.</p>
        <p className="mt-4 text-base text-muted-foreground">Inget konto skapas i detta steg.</p>
        <ol className="mt-10">{["Du anmäler intresse", "Vi kontaktar dig", "Vi går igenom nästa steg"].map((s, i) => <li key={s} className="flex flex-col">
          {i > 0 && <span aria-hidden className="ml-[1.375rem] h-4 w-px bg-border" />}
          <span className="flex items-center gap-6 text-lg"><span className={`grid size-11 shrink-0 place-items-center rounded-full border ${i === 0 ? "border-accent" : "border-foreground/60"}`}>{i + 1}</span>{s}</span>
        </li>)}</ol>
        <Link to={P.studios} className="mt-12 inline-flex items-center gap-6 text-base"><ArrowLeft aria-hidden className="size-6 text-accent" /><span className="border-b border-accent pb-1">Tillbaka till För studios</span></Link>
      </section>
      <section aria-labelledby="p-form" className="ds-card self-start border border-accent/60 bg-card/60 p-6 sm:p-11">
        {sent ? <div role="status">
          <span className="grid size-12 place-items-center rounded-full border border-accent text-accent"><Check aria-hidden className="size-6" /></span>
          <h2 id="p-form" className="mt-6 text-3xl font-medium">Din intresseanmälan är registrerad.</h2>
          <p className="mt-4 text-base text-muted-foreground">Tack. Vi har tagit emot studions uppgifter och kontaktar dig.</p>
        </div> : <form onSubmit={submit} noValidate>
          <h2 id="p-form" className="text-4xl font-medium">Anmäl intresse</h2>
          <div className="mt-8 space-y-6">{fields.map(([k, l, ph]) => <div key={k}>
            <label htmlFor={`pi-${k}`} className="mb-3 block text-base">{l}</label>
            <input id={`pi-${k}`} value={form[k]} placeholder={ph} onChange={e => setForm(c => ({ ...c, [k]: e.target.value }))}
              type={k === "email" ? "email" : k === "phone" ? "tel" : "text"} autoComplete={k === "email" ? "email" : k === "phone" ? "tel" : k === "contactName" ? "name" : "organization"}
              aria-invalid={!!error && !form[k].trim()} className="field-input h-14 bg-background text-lg" />
          </div>)}</div>
          <input tabIndex={-1} aria-hidden autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} className="hidden" />
          {error && <p role="alert" className="field-error mt-4">{error}</p>}
          <button type="submit" disabled={busy} className="mt-8 flex min-h-16 w-full items-center justify-between rounded-xl bg-foreground px-11 text-lg font-medium text-background disabled:opacity-60">
            {busy ? <span className="inline-flex items-center gap-3"><Loader2 aria-hidden className="size-5 animate-spin" />Skicka intresseanmälan</span> : "Skicka intresseanmälan"}<ArrowRight aria-hidden className="size-6" />
          </button>
          <p className="mt-8 text-sm text-muted-foreground">Dina uppgifter används för att besvara din förfrågan.</p>
          <a href="mailto:fredrik@inksimulator.com" className="mt-4 inline-block border-b border-accent pb-1 text-base">Mejla oss i stället</a>
        </form>}
      </section>
    </div>
  </Shell>;
}
