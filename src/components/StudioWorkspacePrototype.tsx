import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  FileQuestion,
  FlaskConical,
  GripVertical,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Section = "today" | "settings" | "mapping";
type Setting = "form" | "notifications" | "times" | "assistant";

const questions = [
  { text: "Finns det något i motivet som absolut måste vara kvar?", required: true, type: "Fritext" },
  { text: "Har du tatuerat området tidigare?", required: false, type: "Ja / nej" },
  { text: "Är du flexibel med datum?", required: false, type: "Ja / nej" },
];

const settingCards = [
  { id: "form" as const, icon: FileQuestion, title: "Formulär", summary: "3 egna frågor", detail: "Kundens idé, ordning och krav" },
  { id: "notifications" as const, icon: Bell, title: "Aviseringar", summary: "E-post och i appen", detail: "Studio och kund var för sig" },
  { id: "times" as const, icon: CalendarDays, title: "Tider", summary: "18 publicerade tider", detail: "Öppettider, regler och tider" },
  { id: "assistant" as const, icon: Bot, title: "Assistent", summary: "Godkännande krävs", detail: "Uppdrag, kunskap och gränser" },
];

function ExampleFlag() {
  return <div className="inline-flex min-h-9 items-center gap-2 rounded-md border border-accent/50 bg-accent/10 px-3 text-xs font-semibold text-foreground"><FlaskConical className="size-4 text-accent" />Prototyp · all information är exempeldata</div>;
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="max-w-2xl"><p className="text-xs font-semibold uppercase text-accent">{eyebrow}</p><h2 className="mt-2 font-display text-3xl uppercase leading-none md:text-4xl">{title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}

function StatusRow() {
  return <div className="grid gap-3 border-y border-border py-4 sm:grid-cols-3">
    <div><p className="text-xs text-muted-foreground">Design</p><Badge className="mt-2 bg-accent/15 text-foreground hover:bg-accent/15"><Eye className="mr-1 size-3" />Väntar på kund</Badge></div>
    <div><p className="text-xs text-muted-foreground">Bokning</p><Badge variant="outline" className="mt-2"><Clock3 className="mr-1 size-3" />Tid föreslagen</Badge></div>
    <div><p className="text-xs text-muted-foreground">Betalning</p><Badge variant="secondary" className="mt-2"><ShieldCheck className="mr-1 size-3" />Handpenning obetald</Badge></div>
  </div>;
}

function TodayView() {
  const [empty, setEmpty] = useState(false);
  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <SectionTitle eyebrow="Arbetsyta" title="Idag" text="Det som behöver ett svar först, sedan nästa besök. Statusarna hålls isär." />
      <Button variant="outline" onClick={() => setEmpty((value) => !value)}>{empty ? "Visa exempelärenden" : "Visa tomt idag"}</Button>
    </div>

    <section aria-labelledby="needs-action">
      <div className="mb-3 flex items-center justify-between"><h3 id="needs-action" className="font-display text-xl uppercase">Behöver ditt svar</h3><span className="text-xs text-muted-foreground">{empty ? "0 ärenden" : "2 ärenden"}</span></div>
      {empty ? <div className="rounded-md border border-dashed border-border bg-card/40 p-6"><Check className="size-5 text-accent" /><p className="mt-3 font-semibold">Inget behöver ditt svar just nu</p><p className="mt-1 text-sm text-muted-foreground">Nästa bokning visas fortfarande nedan.</p></div> : <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-md border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">Förfrågan · 2 timmar sedan</p><h4 className="mt-1 font-display text-xl uppercase">Maja Lind</h4><p className="mt-2 text-sm">Fineline-blommor · underarm · cirka 12 cm</p></div><Badge className="bg-accent text-accent-foreground">Nytt svar</Badge></div><StatusRow /><Button className="mt-4 min-h-11 w-full sm:w-auto">Öppna ärendet<ArrowRight /></Button></article>
        <article className="rounded-md border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">Förfrågan · igår</p><h4 className="mt-1 font-display text-xl uppercase">Leo Berg</h4><p className="mt-2 text-sm">Blackwork · överarm · referens bifogad</p></div><Badge variant="outline">Följ upp</Badge></div><StatusRow /><Button variant="outline" className="mt-4 min-h-11 w-full sm:w-auto">Granska svar<ArrowRight /></Button></article>
      </div>}
    </section>

    <section aria-labelledby="next-visit" className="rounded-md border border-border bg-card p-5 md:p-6">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div><p className="text-xs font-semibold uppercase text-accent">Nästa besök</p><h3 id="next-visit" className="mt-2 font-display text-2xl uppercase">Idag 14:30 · Nora Sjö</h3><p className="mt-2 text-sm text-muted-foreground">3 timmar · Studio 2 · Alex</p></div><div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-md bg-muted p-3"><span className="block text-muted-foreground">Design</span><strong className="mt-1 block">Godkänd</strong></div><div className="rounded-md bg-muted p-3"><span className="block text-muted-foreground">Bokning</span><strong className="mt-1 block">Bekräftad</strong></div><div className="rounded-md bg-muted p-3"><span className="block text-muted-foreground">Betalning</span><strong className="mt-1 block">Betald</strong></div></div></div>
    </section>

    <section><h3 className="mb-3 font-display text-xl uppercase">Snabbval</h3><div className="grid gap-3 sm:grid-cols-3">{[[CalendarDays,"Öppna kalender"],[MessageSquareText,"Se förfrågningar"],[Settings2,"Bokningsinställningar"]].map(([Icon,label]) => { const IconComponent = Icon as typeof CalendarDays; return <Button key={label as string} variant="outline" className="min-h-14 justify-between"><span className="flex items-center gap-2"><IconComponent />{label as string}</span><ChevronRight /></Button>; })}</div></section>
  </div>;
}

function FormPanel() {
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]">
    <div className="rounded-md border border-border bg-card p-5"><h3 className="font-display text-xl uppercase">Egna bokningsfrågor</h3><p className="mt-2 text-sm text-muted-foreground">Placering, storlek, kroppsfoto och idé finns redan i grundformuläret och dupliceras inte här.</p><div className="mt-5 space-y-3">{questions.map((q, index) => <div key={q.text} className="flex gap-3 rounded-md border border-border p-3"><GripVertical className="mt-1 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="text-xs text-muted-foreground">{index + 1}</span><Badge variant={q.required ? "default" : "outline"}>{q.required ? "Obligatorisk" : "Valfri"}</Badge><Badge variant="secondary">{q.type}</Badge></div><p className="mt-2 text-sm">{q.text}</p></div></div>)}</div><Button variant="outline" className="mt-4">Lägg till egen fråga</Button></div>
    <div className="rounded-md border border-accent/40 bg-background p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-accent">Kundförhandsvisning</p><Eye className="size-4 text-muted-foreground" /></div><div className="mt-5 rounded-md border border-border bg-card p-4"><p className="font-display text-xl uppercase">Berätta om din idé</p><div className="mt-4 space-y-4"><div><p className="text-sm font-semibold">Placering <span className="text-accent">*</span></p><div className="mt-2 h-10 rounded-md border border-border bg-muted" /></div><div><p className="text-sm font-semibold">Storlek i cm <span className="text-accent">*</span></p><div className="mt-2 h-10 rounded-md border border-border bg-muted" /></div>{questions.map((q) => <div key={q.text}><p className="text-sm font-semibold">{q.text} {q.required && <span className="text-accent">*</span>}</p><div className="mt-2 h-10 rounded-md border border-border bg-muted" /></div>)}</div></div></div>
  </div>;
}

function NotificationsPanel() {
  return <div className="grid gap-4 md:grid-cols-2"><article className="rounded-md border border-border bg-card p-5"><Bell className="size-5 text-accent" /><h3 className="mt-4 font-display text-xl uppercase">Till studion</h3><p className="mt-2 text-sm text-muted-foreground">Aviseringar om nya förfrågningar, svar och ändringar.</p><div className="mt-5 space-y-4">{["E-post vid ny förfrågan","I appen vid kundsvar","E-post vid ändrad tid"].map((x,i)=><label key={x} className="flex min-h-11 items-center justify-between gap-3 border-t border-border pt-3 text-sm"><span>{x}</span><Switch defaultChecked={i<2} /></label>)}</div></article><article className="rounded-md border border-border bg-card p-5"><MessageSquareText className="size-5 text-accent" /><h3 className="mt-4 font-display text-xl uppercase">Till kunden</h3><p className="mt-2 text-sm text-muted-foreground">Bekräftelser och påminnelser för kundens bokning.</p><div className="mt-5 space-y-4">{["Bekräftelse när förfrågan tagits emot","Bekräftelse när tiden bokats","Påminnelse 24 timmar före"].map((x)=><label key={x} className="flex min-h-11 items-center justify-between gap-3 border-t border-border pt-3 text-sm"><span>{x}</span><Switch defaultChecked /></label>)}</div></article></div>;
}

function TimesPanel() {
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3">{[["Öppettider","Mån–fre · 10:00–18:00","Studions publika öppettider"],["Veckoregler","3 aktiva regler","Skapar möjliga tider"],["Bokningsbara tider","18 publicerade","Det kunden faktiskt kan välja"]].map(([title,value,text])=><article key={title} className="rounded-md border border-border bg-card p-5"><p className="text-xs text-muted-foreground">{title}</p><h3 className="mt-2 font-display text-xl uppercase">{value}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p><Button variant="link" className="mt-3 h-auto p-0">Öppna huvudplatsen<ArrowRight /></Button></article>)}</div><article className="rounded-md border border-accent/40 bg-accent/5 p-5"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div><p className="text-xs font-semibold uppercase text-accent">Förhandsvisning före publicering</p><h3 className="mt-2 font-display text-2xl uppercase">3–30 november</h3><p className="mt-2 text-sm text-muted-foreground">24 möjliga tider · 18 kan publiceras · 6 konflikter</p></div><div className="flex flex-wrap gap-2"><Badge variant="secondary">4 kalenderkonflikter</Badge><Badge variant="secondary">2 redan bokade</Badge><Button>Granska 18 tider<Eye /></Button></div></div></article></div>;
}

function AssistantPanel() {
  const [testOpen, setTestOpen] = useState(false);
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[[ClipboardList,"Uppdrag","Samla idé och föreslå passande tider"],[Sparkles,"Kunskap","Studioinfo och egen fri text"],[ShieldCheck,"Gränser","Inga medicinska råd eller prisgissningar"],[Check,"Kontrollera","Studion godkänner innan bokning"]].map(([Icon,title,text])=>{const I=Icon as typeof ClipboardList;return <article key={title as string} className="rounded-md border border-border bg-card p-5"><I className="size-5 text-accent"/><h3 className="mt-4 font-display text-xl uppercase">{title as string}</h3><p className="mt-2 text-sm text-muted-foreground">{text as string}</p></article>})}</div><div className="grid gap-4 lg:grid-cols-2"><article className="rounded-md border border-border bg-card p-5"><h3 className="font-display text-xl uppercase">Källor som används</h3><dl className="mt-4 space-y-4 text-sm"><div className="flex justify-between gap-3 border-t border-border pt-3"><dt className="text-muted-foreground">Tider</dt><dd className="text-right">Publicerade bokningsbara tider</dd></div><div className="flex justify-between gap-3 border-t border-border pt-3"><dt className="text-muted-foreground">Pris</dt><dd className="text-right">Pris per storlek · S/M/L/XL</dd></div><div className="flex justify-between gap-3 border-t border-border pt-3"><dt className="text-muted-foreground">Beslut</dt><dd className="text-right">Godkännande krävs</dd></div></dl></article><article className="rounded-md border border-accent/40 bg-accent/5 p-5"><FlaskConical className="size-5 text-accent"/><h3 className="mt-4 font-display text-xl uppercase">Isolerat testläge</h3><p className="mt-2 text-sm text-muted-foreground">Testa med exempeldata. Inga riktiga tider bokas och inga meddelanden skickas.</p><Button className="mt-5" onClick={()=>setTestOpen((v)=>!v)}>{testOpen?"Stäng test":"Starta isolerat test"}</Button>{testOpen&&<div className="mt-4 rounded-md border border-border bg-background p-4 text-sm"><p className="text-muted-foreground">Exempelkund</p><p className="mt-2">“Jag vill göra en 10 cm blomma på underarmen. Finns det tid nästa månad?”</p><p className="mt-4 border-t border-border pt-4"><strong>Förslag:</strong> Två publicerade tider hittades. Skicka till studion för godkännande.</p></div>}</article></div></div>;
}

function SettingsView() {
  const [selected, setSelected] = useState<Setting>("form");
  return <div className="space-y-8"><SectionTitle eyebrow="En huvudplats per uppgift" title="Bokningsinställningar" text="Fyra sammanfattningar leder vidare till rätt inställning utan att samma uppgift byggs på flera platser."/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{settingCards.map(({id,icon:Icon,title,summary,detail})=><Button key={id} variant="outline" aria-pressed={selected===id} onClick={()=>setSelected(id)} className={cn("h-auto min-h-28 whitespace-normal p-4 text-left",selected===id&&"border-accent bg-accent/10")}><span className="w-full"><span className="flex items-center justify-between"><Icon className="text-accent"/><span className="text-xs text-muted-foreground">{summary}</span></span><strong className="mt-4 block font-display text-xl uppercase">{title}</strong><span className="mt-1 block text-xs font-normal text-muted-foreground">{detail}</span></span></Button>)}</div><div>{selected==="form"&&<FormPanel/>}{selected==="notifications"&&<NotificationsPanel/>}{selected==="times"&&<TimesPanel/>}{selected==="assistant"&&<AssistantPanel/>}</div></div>;
}

function MappingView() {
  const rows = [
    ["Designgodkännande", "Skissversionens approved_by / approved_at", "Kan visas som godkänd eller väntar. Ingen egen designstatus finns."],
    ["Bokningsstatus", "bookings: pending / confirmed / cancelled", "Tidsluckor och assistentbokningar har separata statusar som ännu inte är en gemensam modell."],
    ["Betalningsstatus", "project_deposits: unpaid / paid / cancelled", "Handpenning kan visas separat. Full betalstatus är inte bekräftad som gemensamt fält."],
    ["Behöver svar", "studio_read_at saknas", "Betyder idag oläst, inte säkert obesvarat. Kräver beslut innan produktion."],
  ];
  return <div className="space-y-8"><SectionTitle eyebrow="Granskningsunderlag" title="Statusmappning" text="Förslaget skiljer begreppen visuellt, men inför inga nya statusar och ändrar ingen affärslogik."/><div className="overflow-x-auto rounded-md border border-border bg-card"><table className="w-full min-w-[46rem] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="p-4 font-normal">Förslag</th><th className="p-4 font-normal">Befintligt stöd</th><th className="p-4 font-normal">Olöst koppling</th></tr></thead><tbody>{rows.map((row)=><tr key={row[0]} className="border-b border-border last:border-0"><th className="p-4 align-top font-semibold">{row[0]}</th><td className="p-4 align-top">{row[1]}</td><td className="p-4 align-top text-muted-foreground">{row[2]}</td></tr>)}</tbody></table></div><div className="grid gap-4 md:grid-cols-3"><article className="rounded-md border border-border bg-card p-5"><h3 className="font-display text-xl uppercase">Återanvänt</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Egna bokningsfrågor och ordning, aviseringskanaler, öppettider och veckoregler, publicerade tider, assistentens bokningsläge, prisval och kunskap.</p></article><article className="rounded-md border border-accent/40 bg-accent/5 p-5"><h3 className="font-display text-xl uppercase">Föreslaget nytt</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Samlad Idag-prioritering, kundförhandsvisning, tidsförhandsvisning med konflikter och isolerat assistenttest med enbart exempeldata.</p></article><article className="rounded-md border border-destructive/40 bg-destructive/5 p-5"><h3 className="font-display text-xl uppercase">Olöst</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Gemensam koppling mellan förfrågan, bokning, tidslucka och assistentbokning; obesvarat kontra oläst; fullständig betalstatus och konfliktkälla.</p></article></div><div className="flex gap-3 rounded-md border border-border bg-muted p-4 text-sm"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-accent"/><p>Ingen rad ovan innebär att en ny status redan stöds. Datakopplingarna behöver bekräftas innan något förs in i produktionspanelen.</p></div></div>;
}

export function StudioWorkspacePrototype() {
  const [section, setSection] = useState<Section>("today");
  return <main className="min-h-screen min-w-0 overflow-x-hidden bg-background text-foreground"><header className="border-b border-border bg-card/80"><div className="mx-auto flex w-full max-w-[90rem] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8"><div><p className="font-display text-2xl uppercase">InkSimulator Studio</p><p className="text-xs text-muted-foreground">Separat granskningsprototyp</p></div><ExampleFlag/></div></header><div className="mx-auto grid w-full min-w-0 max-w-[90rem] grid-cols-[minmax(0,1fr)] gap-0 md:grid-cols-[14rem_minmax(0,1fr)]"><aside className="min-w-0 border-b border-border bg-card md:min-h-[calc(100vh-81px)] md:border-b-0 md:border-r"><nav aria-label="Prototypnavigation" className="flex w-full min-w-0 gap-2 overflow-x-auto p-3 md:sticky md:top-0 md:flex-col md:p-4">{[["today","Idag",Clock3],["settings","Bokningsinställningar",Settings2],["mapping","Statusmappning",ClipboardList]].map(([id,label,Icon])=>{const I=Icon as typeof Clock3;return <Button key={id as string} variant={section===id?"secondary":"ghost"} onClick={()=>setSection(id as Section)} className="min-h-11 shrink-0 justify-start"><I/>{label as string}</Button>})}</nav></aside><div className="w-full min-w-0 px-4 py-8 md:px-8 md:py-10 lg:px-12">{section==="today"&&<TodayView/>}{section==="settings"&&<SettingsView/>}{section==="mapping"&&<MappingView/>}</div></div></main>;
}