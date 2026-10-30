import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";
import { MOTIF_PAGES } from "@/lib/svMotifPages";

const PATH = "/sv/tatueringsmotiv";
const TITLE = "Tatueringsmotiv – inspiration och idéer du kan prova på huden | InkSimulator";
const DESC =
  "Hitta tatueringsmotiv och tatueringsidéer efter stil och placering. Prova motiven gratis på din egen kropp i AR eller på ett foto innan du bokar.";

const FAQ: Faq[] = [
  { q: "Var hittar jag inspiration till tatuering?", a: "I motivbiblioteket kan du bläddra bland motiv från studios och filtrera efter placering och omfattning, till exempel underarm eller halvsleeve." },
  { q: "Kan jag prova ett motiv innan jag bestämmer mig?", a: "Ja. Varje motiv kan provas på huden i AR eller läggas på ett foto, så du ser storlek och placering." },
  { q: "Får jag tatuera motiv från biblioteket?", a: "Motiven tillhör studion som lagt upp dem. Kontakta studion via InkSimulator för att boka eller för att se vad som gäller för motivet." },
  { q: "Kan jag använda en egen bild?", a: "Ja, ladda upp din bild och prova den på samma sätt." },
];

export const Route = createFileRoute("/sv/tatueringsmotiv")({
  head: () =>
    seo({ path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "Tatueringsmotiv", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Inspiration"
      h1="Tatueringsmotiv och idéer"
      intro="Bläddra bland tatueringsmotiv från anslutna studios och prova dem på din egen kropp. Se hur motivet passar innan du bestämmer dig."
      primary={{ to: "/library", label: "Bläddra bland motiv" }}
      secondary={{ to: "/photo-tryon", label: "Prova på ett foto" }}
      faq={FAQ}
    >
      <h2>Populära stilar</h2>
      <ul>
        <li><strong>Fineline</strong> – tunna, lätta linjer för små och diskreta tatueringar.</li>
        <li><strong>Blackwork</strong> – mycket svart och tydliga former.</li>
        <li><strong>Traditional</strong> – kraftiga konturer och klassiska symboler.</li>
        <li><strong>Japanskt</strong> – vågor, drakar och koi, ofta i större format.</li>
        <li><strong>Minimalistiskt</strong> – enkla symboler och geometriska former.</li>
      </ul>
      <h2>Populära motiv</h2>
      <ul>
        {MOTIF_PAGES.map((m) => (
          <li key={m.slug}><a href={`/sv/${m.slug}`}>{m.label}</a></li>
        ))}
      </ul>
      <h2>Filtrera efter placering</h2>
      <p>
        Motiven kan märkas med rekommenderad placering och omfattning – från ett enskilt motiv till
        hel sleeve. Läs om smärta och synlighet i <a href="/sv/tatuering-placering">guiden om placering</a>.
      </p>
      <h2>Hittar du inte rätt?</h2>
      <p>
        Skapa ett eget utkast med <a href="/sv/ai-tatuering">AI-tatuering</a> eller skriv en
        <a href="/sv/tatuering-text"> texttatuering</a>.
      </p>
    </SvLanding>
  );
}
