import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";

const PATH = "/sv/tatuering-text";
const TITLE = "Text tatuering gratis – typsnitt, lettering & AR-provning";
const DESC =
  "Skapa texttatuering gratis: jämför typsnitt för tatuering, lettering och citat. Prova textens storlek och placering i AR eller se tatueringen på foto.";

const FAQ: Faq[] = [
  { q: "Hur skapar jag en texttatuering?", a: "Öppna textgeneratorn, skriv ditt ord, namn eller citat och välj typsnitt. Du kan lägga texten rakt, lodrätt eller i en cirkel och sedan prova den på huden." },
  { q: "Vilket typsnitt passar för tatuering?", a: "Skrivstil och script passar namn och korta ord, gotisk stil ger ett klassiskt uttryck och tunna linjer passar fineline. Mycket små bokstäver kan flyta ihop med tiden – fråga din tatuerare om minsta storlek." },
  { q: "Vilka citat passar som tatuering?", a: "Korta citat på ett fåtal ord blir tydligast. Längre citat behöver mer plats, till exempel på underarmen, revbenen eller ryggen. Prova citatet i rätt storlek innan du bestämmer dig." },
  { q: "Kostar textgeneratorn något?", a: "Nej, det är gratis att skapa och prova text i InkSimulator." },
  { q: "Kan jag ta med texten till studion?", a: "Ja. Spara bilden eller skicka den till en godkänd studio via InkSimulator. Tatueraren gör den slutliga skissen." },
];

export const Route = createFileRoute("/sv/tatuering-text")({
  head: () =>
    seo({ path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "Tatuering med text", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Texttatuering"
      h1="Skapa en tatuering med text"
      intro="Skriv ett namn, ett datum eller ett citat och se direkt hur det ser ut i olika tatueringstypsnitt. Prova sedan texten på armen, handleden eller benet i AR – gratis och utan app."
      primary={{ to: "/tattoo-font-generator", label: "Skapa texttatuering" }}
      secondary={{ to: "/ar", label: "Prova på huden" }}
      faq={FAQ}
    >
      <h2>Så gör du</h2>
      <ol>
        <li>Skriv din text i textgeneratorn.</li>
        <li>Jämför typsnitt: skrivstil, gotiskt, fineline, typewriter med flera.</li>
        <li>Välj layout – vågrätt, lodrätt eller i en cirkel.</li>
        <li>Prova texten på kroppen i AR och spara bilden. Stäm av slutlig storlek med tatueraren.</li>
      </ol>
      <h2>Idéer för texttatuering</h2>
      <ul>
        <li>Namn på barn, partner eller någon du saknar.</li>
        <li>Datum – födelsedag, bröllop eller en viktig dag, gärna med romerska siffror.</li>
        <li>Korta ord och citat på handleden, underarmen eller nyckelbenet.</li>
        <li>Koordinater till en plats som betyder något.</li>
      </ul>
      <h2>Typsnitt för tatuering</h2>
      <ul>
        <li><strong>Skrivstil / script</strong> – mjukt och personligt, passar namn.</li>
        <li><strong>Gotiskt / blackletter</strong> – klassiskt och kraftfullt.</li>
        <li><strong>Fineline</strong> – tunna, diskreta bokstäver.</li>
        <li><strong>Typewriter</strong> – avskalat och modernt.</li>
      </ul>
      <h2>Tatuering citat</h2>
      <p>För datum och årtal finns en särskild guide om <a href="/sv/romerska-siffror-tatuering">romerska siffror som tatuering</a>, med kontrollerade exempel och tips om läsbarhet.</p>
      <p>
        Ett citat kan vara en rad ur en låt, en dikt eller något en närstående har sagt. Välj få ord,
        dubbelkolla stavningen och prova hur radbrytningen ser ut på kroppen innan du bokar.
      </p>
      <h2>Tänk på storleken</h2>
      <p>
        Text behöver plats för att hålla sig läsbar över tid. Prova flera storlekar i AR och läs mer i
        vår <a href="/sv/tatuering-placering">guide om placering och storlek</a>.
      </p>
    </SvLanding>
  );
}
