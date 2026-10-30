import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";

const PATH = "/sv/pris-tatuering";
const TITLE = "Vad kostar en tatuering? Tatuering pris och vad som påverkar | InkSimulator";
const DESC =
  "Vad kostar en tatuering? Se vad som påverkar tatuering pris – storlek, detaljer, placering och tid – och prova storleken på huden innan du ber om offert.";

const FAQ: Faq[] = [
  { q: "Vad kostar en tatuering?", a: "Det varierar mellan studios. Priset beror främst på hur lång tid tatueringen tar, vilket påverkas av storlek, detaljnivå, färg och placering. Be alltid studion om ett prisförslag för just ditt motiv." },
  { q: "Hur mycket kostar en liten tatuering?", a: "Många studios har ett minimipris även för små motiv, eftersom förberedelser och material ingår. Fråga studion vad deras minimipris är." },
  { q: "Varför påverkar storleken priset?", a: "Ett större eller mer detaljerat motiv tar längre tid att tatuera. Genom att prova storleken i AR först kan du ange en mer exakt storlek och få ett tydligare prisförslag." },
  { q: "Tar studion deposition?", a: "Många studios tar en deposition vid bokning. Belopp och villkor sätts av studion och visas innan du bekräftar en bokning via InkSimulator." },
];

export const Route = createFileRoute("/sv/pris-tatuering")({
  head: () =>
    seo({ path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "Vad kostar en tatuering", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Tatuering pris"
      h1="Vad kostar en tatuering?"
      intro="Hur mycket en tatuering kostar beror på motivet, storleken och hur lång tid det tar. Prova storleken på din egen hud först – då blir prisförslaget från studion mer exakt."
      primary={{ to: "/ar", label: "Prova storleken i AR" }}
      secondary={{ to: "/studios", label: "Be en studio om pris" }}
      faq={FAQ}
    >
      <h2>Det här påverkar priset</h2>
      <ul>
        <li><strong>Storlek</strong> – större yta tar längre tid.</li>
        <li><strong>Detaljnivå</strong> – fina linjer, skuggning och realism kräver mer tid.</li>
        <li><strong>Färg eller svart</strong> – färg kan ta längre tid att fylla.</li>
        <li><strong>Placering</strong> – vissa kroppsdelar är svårare att tatuera.</li>
        <li><strong>Antal sittningar</strong> – stora motiv delas ofta upp på flera tillfällen.</li>
        <li><strong>Studions prissättning</strong> – timpris, minimipris och deposition skiljer sig mellan studios.</li>
      </ul>
      <h2>Så får du ett tydligt prisförslag</h2>
      <ol>
        <li>Välj eller skapa ditt motiv.</li>
        <li>Prova det på kroppen i AR och bestäm ungefärlig storlek i cm.</li>
        <li>Skicka bilden, placeringen och storleken till en godkänd studio.</li>
        <li>Studion svarar med pris, tid och eventuell deposition.</li>
      </ol>
      <p>
        Läs mer om <a href="/sv/tatuering-placering">placering och storlek</a> eller
        <a href="/sv/boka-tatuering"> hur du bokar en tatuering</a>.
      </p>
    </SvLanding>
  );
}
