import { createFileRoute, Link } from "@tanstack/react-router";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";
import { seo } from "@/lib/seo";
import rose from "@/assets/tattoo-real-rose.png";

const PATH = "/sv/skapa-tatuering";
const FAQ: Faq[] = [
  { q: "Hur kan jag skapa en egen tatuering?", a: "Börja med en idé, en egen bild, en text eller ett biblioteksmotiv. Använd textgeneratorn eller AI-generatorn för ett utkast, prova placeringen och låt tatueraren göra den slutliga skissen." },
  { q: "Är det gratis att skapa tatuering med AI?", a: "AI-generatorn kräver inloggning och tillgång via konto eller abonnemang; se aktuella villkor i verktyget. Gratis digital provning är inte samma sak som gratis AI-generering, ett motivköp eller en utförd tatuering." },
  { q: "Kan jag använda en bild jag hittat på nätet?", a: "Använd egna bilder eller material som du har tillåtelse att använda. En bild som går att hitta på nätet är inte automatiskt fri att kopiera eller tatuera." },
  { q: "Är AR-provningen en garanti för slutresultatet?", a: "Nej, den hjälper dig jämföra motiv, storlek och placering. Slutlig skala, linjer och lämplighet behöver stämmas av med tatueraren." },
];

export const Route = createFileRoute("/sv/skapa-tatuering")({
  head: () => seo({ path: PATH, title: "Skapa tatuering – egen design, text, AI & AR-provning", description: "Skapa tatueringsmotiv med text, egen bild eller AI-tatueringsgenerator. Testa tatuering i AR eller se den på foto innan du skickar din idé till en studio.", lang: "sv", breadcrumb: "Skapa tatuering", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return <SvLanding current={PATH} kicker="Din idé" h1="Skapa tatuering" intro="Gör din idé tydligare innan du bokar. Välj mellan att skapa text, ta fram ett AI-utkast eller börja med ett färdigt motiv – och jämför sedan hur tatueringen passar på dig." primary={{ to: "/create", label: "Skapa ditt motiv" }} secondary={{ to: "/library", label: "Hitta färdiga skisser" }} faq={FAQ}>
    <figure className="mt-8"><div className="flex h-64 items-center justify-center rounded-lg border border-border bg-paper p-6"><img src={rose} alt="Realistisk rosskiss från InkSimulators motivbibliotek" className="h-full max-w-full object-contain" /></div><figcaption className="mt-2 text-sm">En biblioteksskiss som utgångspunkt – inte en bild av en utförd tatuering.</figcaption></figure>
    <h2>Välj hur du vill börja</h2>
    <ul><li><Link to="/sv/ai-tatuering">Skapa tatuering med AI</Link>: beskriv motiv, stil och detaljer för ett första utkast.</li><li><Link to="/sv/tatuering-text">Skapa texttatuering</Link>: skriv namn, datum eller citat och jämför typsnitt.</li><li><Link to="/library">Välj ett biblioteksmotiv</Link>: börja med en skiss du redan tycker om.</li><li><Link to="/photo-tryon" search={{ motif: undefined }}>Använd en egen bild på ett foto</Link>: jämför placeringen utan livekamera.</li></ul>
    <h2>Skriv en tydlig motivbeskrivning</h2>
    <p>Beskriv vad som ska finnas i bilden, vilken stil du vill ha och vad som ska utelämnas. Exempel: ”En svartvit ros med blad, tydlig siluett och lugn skuggning, utan text eller bakgrund.” Gör sedan en ändring i taget i stället för att lägga till fler detaljer direkt.</p>
    <h2>Testa tatueringen hemma</h2>
    <ol><li>Välj ett motiv och prova det på ett foto eller med mobilkameran i AR.</li><li>Jämför två placeringar med samma motiv och liknande storlek.</li><li>Kontrollera helheten och om små detaljer fortfarande är tydliga.</li><li>Spara förhandsvisningen som underlag för samtalet med studion.</li></ol>
    <p>Digital skala är ett stöd, inte en mätgaranti. Se <Link to="/sv/prova-tatuering">hur AR-provning fungerar</Link> och stäm alltid av slutlig storlek med tatueraren.</p>
    <h2>Från utkast till tatuering</h2>
    <p>AI-bilder och textmotiv är underlag för en riktig skiss. Tatueraren behöver bedöma linjer, detaljer och hudens förutsättningar. Kontrollera rättigheterna till bilden och <Link to="/sv/boka-tatuering">skicka en förfrågan till en godkänd studio</Link> när du har hittat riktningen.</p>
  </SvLanding>;
}