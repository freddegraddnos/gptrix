import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";

const PATH = "/sv/tatuering-placering";
const TITLE = "Tatuering arm, handled & underarm – placering och storlek | InkSimulator";
const DESC =
  "Tatuering på handled, arm eller underarm? Inspiration för små tatueringar och guide till placering: smärta, synlighet och ungefärlig storlek per kroppsdel. Prova storleken på huden i AR innan du bokar.";

const FAQ: Faq[] = [
  { q: "Var gör det minst ont att tatuera sig?", a: "Ytor med mer muskel och hud, som utsidan av överarmen, underarmen och vaden, upplevs ofta som mindre smärtsamma. Områden nära ben, som revben, fötter och armbåge, brukar göra mer ont. Upplevelsen är individuell." },
  { q: "Hur stor ska min tatuering vara?", a: "Det beror på detaljer och placering. Detaljerade motiv och text behöver mer plats för att hålla sig tydliga. Prova flera storlekar i AR och stäm av med tatueraren." },
  { q: "Vilken placering syns minst?", a: "Överarm, lår, rygg och revben täcks ofta av kläder. Hand, hals och underarm syns mest." },
  { q: "Passar en liten tatuering på handleden?", a: "Ja, handleden är populär för små tatueringar. Ytan är begränsad, så välj ett enkelt motiv utan för fina detaljer och prova storleken innan du bokar." },
  { q: "Påverkar storleken priset?", a: "Ofta, eftersom större och mer detaljerade motiv tar längre tid. Priset sätts alltid av studion." },
];

const ROWS = [
  ["Underarm", "Låg–medel", "Hög", "5–20 cm"],
  ["Överarm", "Låg", "Medel", "8–25 cm"],
  ["Handled", "Medel", "Hög", "2–6 cm"],
  ["Nyckelben", "Medel–hög", "Medel", "4–15 cm"],
  ["Revben", "Hög", "Låg", "8–30 cm"],
  ["Rygg", "Medel", "Låg", "10–50 cm"],
  ["Lår", "Låg–medel", "Låg", "10–30 cm"],
  ["Vad", "Medel", "Medel", "8–20 cm"],
];

export const Route = createFileRoute("/sv/tatuering-placering")({
  head: () =>
    seo({ path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "Placering och storlek", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Tatuering placering"
      h1="Var ska tatueringen sitta?"
      intro="Placering och storlek avgör hur tatueringen ser ut, hur mycket den syns och hur det känns att göra den. Jämför kroppsdelar och prova motivet i skala 1:1 innan du bokar."
      primary={{ to: "/ar", label: "Prova storleken i AR" }}
      secondary={{ to: "/photo-tryon", label: "Prova på ett foto" }}
      faq={FAQ}
    >
      <h2>Jämför kroppsdelar</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground">
              <th className="py-2 pr-3">Område</th><th className="py-2 pr-3">Smärta</th><th className="py-2 pr-3">Synlighet</th><th className="py-2">Vanlig storlek</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]} className="border-b border-border/50">
                {r.map((c, i) => <td key={i} className="py-2 pr-3">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs">Värdena är ungefärliga riktmärken. Stäm alltid av storlek och lämplighet med din tatuerare.</p>
      <h2>Inspiration: små tatueringar, arm och handled</h2>
      <ul>
        <li><strong>Tatuering handled</strong> – små symboler, datum och korta ord.</li>
        <li><strong>Tatuering underarm</strong> – text, linjemotiv och medelstora motiv som syns.</li>
        <li><strong>Tatuering arm</strong> – från ett enskilt motiv till halv- eller helsleeve.</li>
        <li><strong>Liten tatuering</strong> – fineline och minimalism; håll detaljerna enkla.</li>
      </ul>
      <p>Hitta fler idéer bland <a href="/sv/tatueringsmotiv">tatueringsmotiv</a>.</p>
      <h2>Välj mellan två ställen</h2>
      <ol>
        <li>Prova motivet på båda ställena i AR.</li>
        <li>Fundera på hur ofta du vill att tatueringen ska synas.</li>
        <li>Kontrollera att motivet får plats utan att detaljerna blir för små.</li>
        <li>Tänk på framtida tatueringar i samma område.</li>
        <li>Spara bilderna och visa tatueraren.</li>
      </ol>
      <p>
        Mer detaljer på engelska finns i <a href="/guides/placement-guide">tattoo placement guide</a>.
      </p>
    </SvLanding>
  );
}
