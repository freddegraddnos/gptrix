import { Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Compass, Image as ImageIcon, PenTool } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { InkSimulatorLockup } from "@/components/brand/InkSimulatorLogo";
import { Button } from "@/components/ui/button";
import { TATTOOS } from "@/lib/tattoos";
import { HOME_TESTIMONIALS } from "@/lib/testimonials";
import homePortrait from "@/assets/home-blonde-tattoo.jpg";

type Lang = "sv" | "en";

import { useSiteLang } from "@/lib/uiLang";

const copy = {
  sv: {
    language: "Välj språk",
    studios: "Studioinloggning",
    artists: "Hitta tatuerare",
    browse: "Börja med ett motiv",
    browseHint: "Motiv ur vårt befintliga bibliotek. Prova om du vill, eller kontakta en tatuerare direkt.",
    artistHint: "Hitta en stil du gillar och fråga artisten. Du behöver inte skapa eller prova först.",
    headline: ["DIN NÄSTA", "TATUERING."],
    subhead: "SE DEN PÅ DIG INNAN STUDION",
    intro: ["Upptäck motiv och tatuerare. Prova eller skapa om du vill — och kontakta rätt artist.", "Ingen nedladdning krävs", "Ingen kostnad"],
    preview: "AR-förhandsvisning",
    try: "Prova tattoos",
    discover: "Utforska motiv",
    photo: "På ett foto",
    create: "Skapa eget",
    testimonials: "Vad andra säger",
    testimonialQuotes: [
      "Förra gången önskade jag att jag inte hade gjort tatueringen större. Det händer aldrig igen! Så skönt att kunna prova exakt storlek och placering hemma först.",
      "Sparade massor av tid i studion. Storlek och placering satt direkt.",
    ],
    how: "Think it - Try it - Ink it",
    steps: [
      ["Tänk det", "Välj, skapa eller ladda upp ett motiv. Vår AI kan göra en vit bakgrund transparent."],
      ["Prova det", "Se motivet på huden i live-AR som en ungefärlig visualisering, eller placera det på ett foto. Flytta, ändra storlek och jämför."],
      ["Tatuera det", "Dela det med vänner eller skicka det till en godkänd studio och boka."],
    ],
    questions: "Frågor",
    faq: [
      ["Är InkSimulator gratis?", "Ja. Det är gratis att prova tatueringar på foto eller i live-AR."],
      ["Behöver jag en app eller ett konto?", "Ingen app behövs — InkSimulator körs i webbläsaren på iPhone, Android och dator. Konto behövs bara för att spara, dela, skicka en bokningsförfrågan eller använda AI-generatorn."],
      ["Sparas min kamerabild?", "Nej. Kameran stannar på din enhet. Inget spelas in eller laddas upp om du inte själv väljer att spara eller dela en bild."],
      ["Hur exakt är storleken?", "Provningen är en ungefärlig visualisering. Kalibrera för att uppskatta storleken och bekräfta slutlig storlek och placering med din tatuerare."],
      ["Hur bokar jag en studio?", "Välj Boka tatuering, välj en godkänd studio och skicka din förfrågan med provbilden. Studion svarar via mejl, så du behöver ett konto — men det är gratis att skapa konto och skicka en förfrågan."],
    ],
    studioKicker: "För tatueringsstudios",
    studioTitle: "Byggt för tatueringsstudios",
    studioItems: [
      ["Fler kunder.", "Besökare simulerar och skapar tatueringsprojekt här — låt dem skicka en förfrågan till er."],
      ["Nöjdare kunder.", "Storlek och placering kan förberedas innan studiobesöket."],
      ["Spara tid.", "Minska antalet stencilbyten och otydliga första dialoger."],
    ],
  },
  en: {
    language: "Choose language",
    studios: "Studio login",
    artists: "Find an artist",
    browse: "Start with a design",
    browseHint: "Designs from our existing library. Try one if you like, or contact an artist directly.",
    artistHint: "Find a style you like and ask the artist. Creating and trying on are optional.",
    headline: ["YOUR NEXT", "TATTOO."],
    subhead: "SEE IT ON YOU FIRST.",
    intro: ["Discover designs and artists. Try or create if you like — and contact the right artist.", "No download required", "No cost"],
    preview: "AR preview",
    try: "Try tattoos",
    discover: "Explore designs",
    photo: "On a photo",
    create: "Create your own",
    testimonials: "What people say",
    testimonialQuotes: HOME_TESTIMONIALS.map((item) => item.quote),
    how: "Think it - Try it - Ink it",
    steps: [
      ["Think it", "Pick, create or upload a design. Our AI can make a white background transparent."],
      ["Try it", "See it on your skin in live AR as an approximate visualization, or place it on a photo. Move, resize and compare."],
      ["Ink it", "Share it with friends, or send it to an approved studio and book."],
    ],
    questions: "Questions",
    faq: [
      ["Is InkSimulator free?", "Yes. Trying tattoos on a photo or in live AR is free."],
      ["Do I need an app or an account?", "No app — it runs in your browser on iPhone, Android and desktop. You only need an account to save, share, send a booking request or use the AI generator."],
      ["Is my camera image stored?", "No. The camera stays on your device. Nothing is recorded or uploaded unless you choose to save or share a picture."],
      ["How accurate is the size?", "Try-on is an approximate visualization. Calibrate to estimate size and confirm the final size and placement with your tattoo artist."],
      ["How do I book a studio?", "Choose Book tattoo, select an approved studio and send your request with the try-on image. The studio replies by email, so you will need an account — but creating an account and sending a request is free."],
    ],
    studioKicker: "For tattoo studios",
    studioTitle: "Built for tattoo studios",
    studioItems: [
      ["More customers.", "Visitors simulate and create tattoo projects here — let them send your studio a request."],
      ["Happier customers.", "Size and placement can be prepared before the studio visit."],
      ["Save your time.", "Reduce stencil changes and unclear first conversations."],
    ],
  },
} as const;

function ArCorner({ className }: { className: string }) {
  return <span aria-hidden className={`absolute size-6 opacity-40 ${className}`} style={{ borderColor: "var(--ar-corner)", filter: "drop-shadow(0 0 2px var(--ar-glow))" }} />;
}

export function HomePosterPage() {
  // One remembered site language for the homepage and every customer page after it.
  const [lang, selectLang] = useSiteLang() as [Lang, (next: Lang) => void];

  const t = copy[lang];

  return (
    <div className="home-poster min-h-[100dvh] bg-background pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-foreground">
      <div className="mx-auto w-full max-w-[46rem] overflow-hidden border-x border-border bg-background">
        <section className="relative isolate h-[calc(100dvh-4.25rem)] min-h-[40rem] overflow-hidden sm:min-h-[44rem]" aria-labelledby="home-title">
          <img src={homePortrait} alt="Blond woman with a black-and-grey moth tattoo on her arm" width={1024} height={1536} className="absolute inset-0 -z-20 h-full w-full object-cover object-[68%_center] sm:object-[62%_center]" fetchPriority="high" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--background)_72%,transparent)_0%,color-mix(in_oklab,var(--background)_42%,transparent)_22%,transparent_47%,color-mix(in_oklab,var(--background)_35%,transparent)_73%,var(--background)_100%)]" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--background)_90%,transparent)_0%,color-mix(in_oklab,var(--background)_55%,transparent)_48%,transparent_78%)]" />

          <header className="flex items-center justify-between gap-2 px-3 pt-[calc(1rem+env(safe-area-inset-top))] min-[360px]:px-4 sm:px-7">
            <InkSimulatorLockup markClassName="h-10" imgClassName="h-10 w-auto min-[360px]:h-12" className="shrink-0" />
            <div className="flex items-center gap-1.5 sm:gap-4">
              <div role="group" aria-label={t.language} className="flex min-h-11 items-center text-[14px] font-medium">
                <button type="button" onClick={() => selectLang("sv")} aria-pressed={lang === "sv"} className={`min-h-11 min-w-9 px-1 ${lang === "sv" ? "text-foreground" : "text-muted-foreground"}`}>SV</button>
                <span aria-hidden className="text-muted-foreground">/</span>
                <button type="button" onClick={() => selectLang("en")} aria-pressed={lang === "en"} className={`min-h-11 min-w-9 px-1 ${lang === "en" ? "text-foreground" : "text-muted-foreground"}`}>EN</button>
              </div>
              <span aria-hidden className="h-6 w-px bg-border" />
              <Button asChild variant="outline" className="h-10 border-accent/70 bg-background/70 px-2 text-[9px] font-normal backdrop-blur-sm hover:bg-accent hover:text-accent-foreground min-[360px]:px-3 min-[360px]:text-[11px]">
                <Link to={lang === "sv" ? "/sv/artists" : "/artists"}>{t.studios}<ArrowRight className="size-3.5 -rotate-45" /></Link>
              </Button>
            </div>
          </header>

          <div className="px-5 pt-8 sm:px-8 sm:pt-14">
            <h1 id="home-title" className="font-display text-[clamp(3.1rem,15.5vw,6.5rem)] leading-[0.98] text-foreground" style={{ WebkitTextStroke: "0.03em currentColor" }}><span className="block">{t.headline[0]}</span><span className="block">{t.headline[1]}</span></h1>
            <p className="mt-0.5 whitespace-nowrap font-display leading-[0.94] text-foreground" style={{ fontSize: "calc((min(100vw, 46rem) - 4.25rem) / 11.2)", WebkitTextStroke: "0.03em currentColor", textShadow: "0 0 8px rgba(168,85,247,0.9), 0 0 18px rgba(147,51,234,0.8), 0 0 30px rgba(126,34,206,0.6)" }}>{t.subhead}</p>
            <p className="mt-2 max-w-[40ch] text-[12px] leading-[1.45] text-foreground/90 sm:text-sm">{t.intro.map((line) => <span key={line} className="block">{line}</span>)}</p>
          </div>

          <div aria-label={t.preview} className="pointer-events-none absolute inset-0">
            <ArCorner className="left-[73%] top-[30%] rotate-[12deg] border-l-2 border-t-2" />
            <ArCorner className="right-[1%] top-[31%] rotate-[12deg] border-r-2 border-t-2" />
            <ArCorner className="left-[59%] top-[64%] rotate-[12deg] border-b-2 border-l-2" />
            <ArCorner className="right-[16%] top-[64%] rotate-[12deg] border-b-2 border-r-2" />
            <span className="absolute right-[5%] top-[67%] rounded-sm border border-accent/70 bg-background/75 px-2 py-1 text-[8px] text-foreground backdrop-blur-sm">{t.preview}</span>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-3 pb-1.5 sm:px-6 sm:pb-16">
            <div className="grid gap-2">
              <Button asChild className="h-14 flex-row gap-3 rounded-xl border-2 border-accent bg-foreground font-display text-xl text-background shadow-[0_0_18px_color-mix(in_oklab,var(--accent)_75%,transparent)] hover:bg-foreground/90">
                <Link to="/ar" search={{ start: "design" }}><Camera className="size-6" />{t.try}</Link>
              </Button>
              <Button asChild variant="outline" className="relative h-12 flex-row gap-3 rounded-xl border-foreground/75 bg-background/75 px-12 text-[14px] font-normal text-foreground backdrop-blur-sm hover:border-accent hover:bg-background">
                <Link to="/library"><Compass className="size-5" /><span className="text-center">{t.discover}</span><ArrowRight className="absolute right-4 top-1/2 size-5 -translate-y-1/2" /></Link>
              </Button>
              <Link to="/studios" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background/90 text-sm focus-visible:outline-2 focus-visible:outline-accent">{t.artists}<ArrowRight className="size-4" /></Link>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5">
                <Link to="/photo-tryon" search={{ motif: undefined }} className="inline-flex min-h-9 items-center justify-center gap-1 whitespace-nowrap border-b-2 border-accent text-[10px] text-foreground focus-visible:outline-2 focus-visible:outline-accent min-[360px]:gap-2 min-[360px]:text-[12px]">{t.photo}<ImageIcon className="size-4 text-accent" /></Link>
                <span aria-hidden className="h-7 w-px bg-border" />
                <Link to="/create" className="inline-flex min-h-9 items-center justify-center gap-1 whitespace-nowrap border-b-2 border-accent text-[10px] text-foreground focus-visible:outline-2 focus-visible:outline-accent min-[360px]:gap-2 min-[360px]:text-[12px]">{t.create}<PenTool className="size-4 text-accent" /></Link>
              </div>
            </div>
          </div>
        </section>

        <main className="px-4 pb-14 pt-5 sm:px-8 sm:pt-7">
          <section aria-labelledby="discover-title" className="mb-12">
            <h2 id="discover-title" className="font-display text-3xl">{t.browse}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.browseHint}</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {TATTOOS.slice(0, 3).map((motif) => <Link key={motif.id} to="/ar" search={{ motif: motif.id }} className="group rounded-xl border border-border p-2 focus-visible:outline-2 focus-visible:outline-accent">
                <img src={motif.src} alt={motif.name} width={160} height={160} loading="lazy" className="aspect-square w-full rounded-lg bg-white object-contain p-3" />
                <span className="mt-2 block text-xs leading-5">{motif.name}</span>
                <span className="block text-xs text-accent">{t.try} →</span>
              </Link>)}
            </div>
            <div className="mt-5 rounded-xl border border-accent/40 p-4">
              <Link to="/studios" className="inline-flex min-h-11 items-center gap-2 font-display text-xl focus-visible:outline-2 focus-visible:outline-accent">{t.artists}<ArrowRight className="size-5" /></Link>
              <p className="text-sm leading-6 text-muted-foreground">{t.artistHint}</p>
            </div>
          </section>
          <section aria-labelledby="testimonials-title">
            <p id="testimonials-title" className="text-center text-[10px] uppercase text-accent">{t.testimonials}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {HOME_TESTIMONIALS.map((item, index) => <figure key={item.name} className="border border-border bg-card p-5"><blockquote className="text-[12px] leading-6">“{t.testimonialQuotes[index]}”</blockquote><figcaption className="mt-3 font-display text-base text-muted-foreground">{item.name}</figcaption></figure>)}
            </div>
          </section>

          <section className="mt-16" aria-labelledby="how-title">
            <h2 id="how-title" className="text-center font-display text-3xl">{t.how}</h2>
            <ol className="mt-5 grid gap-3">
              {t.steps.map(([title, text], index) => <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-3 border-t border-border py-5"><span className="font-display text-3xl text-accent">0{index + 1}</span><div><h3 className="font-display text-xl">{title}</h3><p className="mt-2 text-[12px] leading-6 text-muted-foreground">{text}</p></div></li>)}
            </ol>
          </section>

          <section className="mt-16" aria-labelledby="faq-title">
            <h2 id="faq-title" className="text-center font-display text-3xl">{t.questions}</h2>
            <div className="mt-5 divide-y divide-border border-y border-border">
              {t.faq.map(([question, answer]) => <details key={question} className="group py-3"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[13px] font-medium">{question}<span aria-hidden className="text-xl text-accent transition-transform group-open:rotate-45">+</span></summary><p className="pb-3 text-[12px] leading-6 text-muted-foreground">{answer}</p></details>)}
            </div>
          </section>

          <section className="mt-16 border-t-2 border-accent px-1 pt-8" aria-labelledby="studio-title">
            <p className="text-[10px] uppercase text-accent">{t.studioKicker}</p>
            <h2 id="studio-title" className="mt-2 font-display text-3xl">{t.studioTitle}</h2>
            <ul className="mt-5 space-y-4 text-[12px] leading-6">{t.studioItems.map(([title, text]) => <li key={title}><strong className="text-accent">{title}</strong> {text}</li>)}</ul>
            <Button asChild className="mt-6 h-12 bg-foreground font-display text-lg text-background hover:bg-foreground/90"><Link to={lang === "sv" ? "/sv/artists" : "/artists"}>{t.studios}<ArrowRight /></Link></Button>
          </section>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}