import { createFileRoute, Link } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";

const PATH = "/sv/skapa-tatueringsmotiv";
const TITLE = "Skapa tatueringsmotiv – med text, AI eller egen bild + AR | InkSimulator";
const DESC =
  "Skapa ditt eget tatueringsmotiv med texttypsnitt, AI-tatueringsgenerator eller egen bild. Prova motivet på huden i AR eller på foto innan du går till studion.";

const FAQ: Faq[] = [
  { q: "Hur skapar jag ett eget tatueringsmotiv?", a: "Välj en väg: skriv text med tatueringstypsnitt, beskriv en idé för AI-generatorn eller ladda upp en egen bild. Prova sedan motivet på kroppen." },
  { q: "Kan jag skapa tatueringsmotiv med AI gratis?", a: "AI-generatorn kräver inloggning och tillgång via konto eller abonnemang; se aktuella villkor i verktyget. Textverktyget och digital provning kan användas utan AI." },
  { q: "Kan tatueraren använda mitt motiv direkt?", a: "Se motivet som underlag. Tatueraren ritar ofta om det så att linjer och detaljer fungerar på huden." },
  { q: "Får jag använda bilder från nätet?", a: "Använd bara egna bilder eller material du har rätt att använda." },
];

export const Route = createFileRoute("/sv/skapa-tatueringsmotiv")({
  head: () => seo({ path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "Skapa tatueringsmotiv", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Egen design"
      h1="Skapa ditt eget tatueringsmotiv"
      intro="Ta fram ett motiv med text, AI eller en egen bild – och se direkt hur det ser ut på din kropp innan du kontaktar en studio."
      primary={{ to: "/create", label: "Skapa motiv" }}
      secondary={{ to: "/ar", label: "Prova i AR" }}
      faq={FAQ}
    >
      <h2>Tre sätt att skapa motiv</h2>
      <ul>
        <li><strong>Text och lettering</strong> – skriv namn, datum eller citat och jämför typsnitt, kurvor och cirklar. <Link to="/sv/tatuering-text">Läs om texttatuering</Link>.</li>
        <li><strong>AI-utkast</strong> – beskriv stil, objekt och känsla så ritar AI:n ett förslag. <Link to="/sv/ai-tatuering">Läs om AI-tatuering</Link>.</li>
        <li><strong>Egen bild</strong> – ladda upp en skiss eller ett foto du har rätt att använda.</li>
      </ul>
      <h2>Tips för ett bra motiv</h2>
      <ol>
        <li>Börja enkelt: ett huvudmotiv och en tydlig stil.</li>
        <li>Undvik små detaljer som flyter ihop i mindre storlekar.</li>
        <li>Prova motivet på kroppen och justera storlek och placering.</li>
        <li>Spara bilden och ta med den till tatueraren.</li>
      </ol>
      <h2>Från motiv till tatuering</h2>
      <p>När du har en riktning kan du <Link to="/sv/prova-tatueringsmotiv">jämföra fler motiv</Link> och <Link to="/sv/boka-tatuering">skicka en förfrågan till en godkänd studio</Link>. Tatueraren gör den slutliga skissen.</p>
    </SvLanding>
  );
}
