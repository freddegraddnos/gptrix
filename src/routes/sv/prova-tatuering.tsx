import { createFileRoute, Link } from "@tanstack/react-router";
import { seo } from "@/lib/seo";

const TITLE = "Prova tatuering i AR – gratis, ingen app";
const DESC =
  "Prova tatuering i AR gratis, direkt i webbläsaren – ingen app. InkSimulator låter dig testa tatueringar och tatueringsmotiv hemma med mobilkameran eller på foto. Jämför motiv, storlek och placering innan du bokar.";

const FAQ = [
  {
    q: "Behöver jag ladda ner en app?",
    a: "Nej. InkSimulator körs i webbläsaren på iPhone, Android och dator. Du ger kameran tillåtelse och börjar direkt.",
  },
  {
    q: "Hur stor blir tatueringen i AR?",
    a: "Förhandsvisningen hjälper dig bedöma ungefärlig storlek, men är inte en garanti för fysisk skala 1:1. Kamera, avstånd och inställningar påverkar bilden. Stäm alltid av slutlig storlek med tatueraren.",
  },
  {
    q: "Kan jag prova utan kamera?",
    a: "Ja. Med fotoläget lägger du motivet på en bild du redan har tagit.",
  },
  {
    q: "Kan jag prova egna motiv?",
    a: "Ja. Ladda upp en bild, skriv text med tatueringstypsnitt eller skapa ett utkast med AI-generatorn och prova det sedan på huden.",
  },
];

export const Route = createFileRoute("/sv/prova-tatuering")({
  head: () =>
    seo({
      path: "/sv/prova-tatuering",
      title: TITLE,
      description: DESC,
      lang: "sv",
      breadcrumb: "Prova tatuering i AR",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: "sv",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
      ],
    }),
  component: ProvaTatuering,
});

const btn =
  "inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-bold text-sm";

function ProvaTatuering() {
  return (
    <main lang="sv" className="mx-auto max-w-2xl px-5 py-10 text-foreground">
      <p className="text-xs uppercase tracking-widest text-accent">AR-tatuering</p>
      <h1 className="mt-2 font-display text-4xl uppercase leading-none md:text-5xl">
        Prova tatuering på huden innan du bokar
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Med InkSimulator ser du en tatuering på din egen kropp i liveläge med mobilkameran, i
        en digital förhandsvisning. Testa storlek, placering och motiv – gratis och utan att ladda ner någon app.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/ar" className={`${btn} bg-accent text-accent-foreground`}>
          Prova i AR nu
        </Link>
        <Link to="/photo-tryon" search={{ motif: undefined }} className={`${btn} border border-border`}>
          Prova på ett foto
        </Link>
      </div>

      <h2 className="mt-12 font-display text-2xl uppercase">Så fungerar det</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>Välj ett motiv i biblioteket, skriv en text eller ladda upp en egen bild.</li>
        <li>Rikta kameran mot armen, benet eller där du vill ha tatueringen.</li>
        <li>Motivet följer huden när du rör dig. Justera storlek och vinkel.</li>
        <li>Spara bilden och ta med den till din tatuerare.</li>
      </ol>

      <h2 className="mt-10 font-display text-2xl uppercase">Hitta motiv och placering</h2>
      <ul className="mt-3 space-y-2 text-muted-foreground">
        <li>
          <Link to="/library" className="underline">Tatueringsmotiv</Link> – bläddra efter stil och
          prova direkt.
        </li>
        <li>
          <Link to="/tattoo-font-generator" className="underline">Textgenerator</Link> – skriv ett
          namn eller citat i tatueringstypsnitt.
        </li>
        <li>
          <Link to="/generator" className="underline">AI-tatueringsgenerator</Link> – beskriv din idé
          och få ett första utkast.
        </li>
        <li>
          <Link to="/guides/placement-guide" className="underline">Placeringsguide</Link> (engelska) –
          smärta, synlighet och storlek per kroppsdel.
        </li>
        <li>
          <Link to="/studios" className="underline">Hitta en godkänd studio</Link> och skicka din
          förhandsvisning.
        </li>
      </ul>

      <p className="mt-6 text-sm text-muted-foreground">
        Fler guider: <Link to="/sv/tatuering-text" className="underline">tatuering med text</Link>,{" "}
        <Link to="/sv/ai-tatuering" className="underline">AI-tatuering</Link>,{" "}
        <Link to="/sv/tatueringsmotiv" className="underline">tatueringsmotiv</Link>,{" "}
        <Link to="/sv/tatuering-placering" className="underline">placering</Link> och{" "}
        <Link to="/sv/boka-tatuering" className="underline">boka tatuering</Link>.
      </p>

      <h2 className="mt-10 font-display text-2xl uppercase">Vanliga frågor</h2>
      <div className="mt-3 space-y-4">
        {FAQ.map((f) => (
          <div key={f.q}>
            <h3 className="font-bold">{f.q}</h3>
            <p className="mt-1 text-muted-foreground">{f.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
