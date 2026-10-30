import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";

const PATH = "/sv/boka-tatuering";
const TITLE = "Boka tatuering – tatuerare & tatueringsstudio i Stockholm, Göteborg, Malmö och Sverige | InkSimulator";
const DESC =
  "Hitta tatuerare i Stockholm och övriga Sverige och boka tatuering hos en godkänd tatueringsstudio. Prova motivet på huden först och skicka förhandsvisningen med din förfrågan.";

const FAQ: Faq[] = [
  { q: "Hur bokar jag en tatuering?", a: "Välj en studio, öppna studions sida och skicka en förfrågan med motiv, placering och ungefärlig storlek. Studion återkommer med förslag på tid och pris." },
  { q: "Vad ska jag skicka med i förfrågan?", a: "En bild på motivet eller idén, var på kroppen den ska sitta, ungefärlig storlek och gärna en bild från provningen i AR." },
  { q: "Måste jag vara 18 år?", a: "Ja. Du behöver vara 18 år eller äldre för att boka tatuering via InkSimulator." },
  { q: "Vad kostar det att boka?", a: "Priset och eventuell deposition sätts av studion och visas innan du bekräftar." },
];

export const Route = createFileRoute("/sv/boka-tatuering")({
  head: () =>
    seo({ path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "Boka tatuering", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Boka tatuering"
      h1="Boka tatuering hos en godkänd studio"
      intro="Hitta en tatuerare, prova motivet på din egen hud och skicka förhandsvisningen direkt med förfrågan. Då vet studion vad du vill ha från början."
      primary={{ to: "/studios", label: "Hitta studio" }}
      secondary={{ to: "/ar", label: "Prova motivet först" }}
      faq={FAQ}
    >
      <h2>Så bokar du</h2>
      <ol>
        <li>Prova motivet i AR eller på ett foto.</li>
        <li>Välj en av de godkända studiorna.</li>
        <li>Skicka förfrågan med bild, placering och storlek.</li>
        <li>Studion svarar med tid, pris och eventuell deposition.</li>
      </ol>
      <h2>Tatuerare i Stockholm och i hela Sverige</h2>
      <p>
        Letar du efter en tatueringsstudio i Stockholm eller på annan ort? I studiolistan ser du anslutna
        tatuerare, deras stil och motiv, och kan skicka din idé direkt till den studio du gillar.
      </p>
      <p>
        Tatuerare per stad: <a href="/sv/tatuerare-stockholm">Stockholm</a> · <a href="/sv/tatuerare-goteborg">Göteborg</a> ·{" "}
        <a href="/sv/tatuerare-malmo">Malmö</a> · <a href="/sv/tatuerare-linkoping">Linköping</a> ·{" "}
        <a href="/sv/tatuerare-helsingborg">Helsingborg</a>
      </p>
      <h2>Bara granskade studios</h2>
      <p>
        Alla studios på InkSimulator är manuellt godkända. Du ser deras sidor, motiv och lediga tider på ett
        ställe.
      </p>
      <h2>Har du ingen idé än?</h2>
      <p>
        Hämta inspiration bland <a href="/sv/tatueringsmotiv">tatueringsmotiv</a>, testa
        <a href="/sv/ai-tatuering"> AI-tatuering</a> eller läs om <a href="/sv/tatuering-placering">placering</a>.
      </p>
    </SvLanding>
  );
}
