import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";

const PATH = "/sv/texttatuering-ai-ar";
const TITLE = "Bästa sättet att skapa texttatuering med AI + AR | InkSimulator";
const DESC =
  "Guide: skapa en texttatuering med typsnitt, kurva och 1:1-test i AR. Skriv namn eller citat, böj texten efter kroppen och se den på huden innan du bokar.";

const FAQ: Faq[] = [
  { q: "Vad är det bästa sättet att skapa en texttatuering?", a: "Skriv texten, jämför flera typsnitt, välj form (rak, lodrät, båge eller cirkel) och prova den sedan på din egen hud i AR i naturlig storlek. Ta med bilden till tatueraren som gör den slutliga skissen." },
  { q: "Vad betyder 1:1-test?", a: "Att du ser texten i ungefär verklig storlek på kroppen via kameran, så att du kan bedöma läsbarhet och placering. Storleken är ungefärlig – stäm av slutliga mått med din tatuerare." },
  { q: "Kan jag böja texten efter armen eller nyckelbenet?", a: "Ja. Välj båge eller cirkel och justera kurvan så att texten följer kroppens form." },
  { q: "Hur hjälper AI till?", a: "Med AI-generatorn kan du ta fram motiv och idéer som kombineras med text. Själva bokstäverna skapas med riktiga typsnitt så att stavningen blir exakt." },
  { q: "Kostar det något?", a: "Nej, det är gratis att skapa och prova texttatueringar i InkSimulator." },
];

export const Route = createFileRoute("/sv/texttatuering-ai-ar")({
  head: () =>
    seo({ path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "Texttatuering med AI + AR", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Guide"
      h1="Bästa sättet att skapa texttatuering med AI + AR"
      intro="Typsnitt, kurva och ett 1:1-test på huden – så går du från ett ord i huvudet till en text du vet passar på kroppen, innan du bokar tid."
      primary={{ to: "/tattoo-font-generator", label: "Skapa texttatuering" }}
      secondary={{ to: "/ar", label: "Prova i AR" }}
      faq={FAQ}
    >
      <h2>1. Skriv texten</h2>
      <p>
        Börja med ordet, namnet, datumet eller citatet. Dubbelkolla stavning och tecken – det är
        det svåraste att ändra efteråt.
      </p>
      <h2>2. Välj typsnitt</h2>
      <p>
        Jämför texten i 18 tatueringstypsnitt: skrivstil, gotiskt/blackletter, stencil,
        handskrift, fineline och typewriter. Du kan även lägga till egna typsnitt.
      </p>
      <ul>
        <li><strong>Skrivstil</strong> – personligt, passar namn.</li>
        <li><strong>Gotiskt</strong> – kraftfullt och klassiskt.</li>
        <li><strong>Fineline</strong> – diskret, behöver ofta lite större storlek för att hålla.</li>
      </ul>
      <h2>3. Böj texten med kurva</h2>
      <p>
        Välj vågrätt, lodrätt, båge eller hel cirkel och justera kurvan och teckenavståndet. En
        båge följer nyckelbenet eller underarmen, en cirkel passar runt ett motiv.
      </p>
      <h2>4. Testa 1:1 på huden i AR</h2>
      <p>
        Öppna kameran och placera texten där du vill ha den. Du ser den i ungefär verklig storlek,
        så du kan bedöma läsbarhet, radbrytning och placering. Ingen app behövs.
      </p>
      <h2>5. Kombinera med AI-motiv</h2>
      <p>
        Vill du ha text tillsammans med ett motiv? Skapa en idé i <a href="/sv/ai-tatuering">AI-generatorn</a> och
        prova båda tillsammans.
      </p>
      <h2>6. Ta med den till studion</h2>
      <p>
        Spara bilden eller skicka den till en godkänd studio. Tatueraren gör den slutliga skissen
        och bekräftar storlek. Läs mer om <a href="/sv/tatuering-text">typsnitt och citat</a> och
        om <a href="/sv/tatuering-placering">placering och storlek</a>.
      </p>
    </SvLanding>
  );
}
