import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";

const PATH = "/sv/ai-tatuering";
const TITLE = "AI tatuering – skapa tatuering med AI-tatueringsgenerator & AR";
const DESC =
  "AI tatuering: skapa tatueringsmotiv med AI-tatueringsgenerator, prova tatueringen på huden i AR eller på foto och ta med idén till tatueraren.";

const FAQ: Faq[] = [
  { q: "Är AI tatuering gratis?", a: "AI-generatorn kräver inloggning och tillgång via konto eller abonnemang. Kontrollera aktuella villkor i generatorn. Digital provning är separat från AI-generering, köp av motiv och själva tatueringen." },
  { q: "Hur fungerar en AI-tatueringsgenerator?", a: "Du beskriver motivet med ord – till exempel stil, objekt och känsla – och AI:n ritar ett utkast som du kan prova på kroppen." },
  { q: "Kan jag tatuera AI-bilden direkt?", a: "Se utkastet som inspiration. En tatuerare ritar om motivet så att linjer och detaljer fungerar på huden och åldras bra." },
  { q: "Kan jag skriva på svenska?", a: "Ja, du kan beskriva idén på svenska eller engelska." },
  { q: "Vad ska jag skriva för bästa resultat?", a: "Ange stil (fineline, blackwork, traditional), huvudmotiv, detaljnivå och om det ska vara svartvitt. Kortare och tydligare beskrivningar ger ofta renare motiv." },
];

export const Route = createFileRoute("/sv/ai-tatuering")({
  head: () =>
    seo({
      path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "AI-tatuering",
      jsonLd: [
        faqLd(FAQ),
        { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "InkSimulator AI-tatueringsgenerator", applicationCategory: "DesignApplication", operatingSystem: "Web", inLanguage: "sv", url: `https://www.inksimulator.com/generator` },
      ],
    }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Tatuering AI"
      h1="Skapa tatueringsidéer med AI"
      intro="Beskriv tatueringen du drömmer om så skapar AI:n ett första utkast. Prova motivet direkt på din egen hud i AR och ta med idén till tatueraren."
      primary={{ to: "/generator", label: "Öppna AI-generatorn" }}
      secondary={{ to: "/ar", label: "Prova i AR" }}
      faq={FAQ}
    >
      <h2>Från idé till förhandsvisning</h2>
      <ol>
        <li>Skriv vad du vill ha, till exempel "fineline-svala med blommor, svartvit".</li>
        <li>Välj det utkast du gillar mest.</li>
        <li>Prova det på kroppen i AR eller på ett foto. Se storleken som ett digitalt placeringsförslag.</li>
        <li>Skicka bilden till en studio och be om en riktig skiss.</li>
      </ol>
      <h2>Exempel att börja med</h2>
      <ul>
        <li>Minimalistisk bergskedja i tunna linjer för underarmen.</li>
        <li>Traditionell ros med dolk, kraftiga konturer.</li>
        <li>Japansk våg i blackwork för överarmen.</li>
        <li>Liten måne och stjärnor för handleden.</li>
      </ul>
      <h2>Utkast, inte färdig stencil</h2>
      <p>Vill du jämföra olika sätt att börja? Läs <a href="/sv/skapa-tatuering">skapa en egen tatuering</a>. För specifika uttryck finns också <a href="/sv/fineline-tatuering">fineline</a>, <a href="/sv/realistisk-tatuering">realism</a> och <a href="/sv/djur-tatuering">djurtatueringar</a>.</p>
      <p>
        AI är bra för att hitta riktningen. Tatueraren anpassar linjer, storlek och placering. Vill du hellre
        börja från färdiga motiv? Se <a href="/sv/tatueringsmotiv">tatueringsmotiv</a>, eller skapa
        <a href="/sv/tatuering-text"> en texttatuering</a>.
      </p>
    </SvLanding>
  );
}
