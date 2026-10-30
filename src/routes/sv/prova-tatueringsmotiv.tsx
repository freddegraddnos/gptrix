import { createFileRoute, Link } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";
import { Button } from "@/components/ui/button";
import { TATTOOS } from "@/lib/tattoos";

const PATH = "/sv/prova-tatueringsmotiv";
const TITLE = "Prova tatueringsmotiv i AR – testa motiv på huden | InkSimulator";
const DESC =
  "Prova tatueringsmotiv direkt på din egen kropp med mobilkameran eller på ett foto. Jämför motiv, stil, storlek och placering innan du bokar en studio.";

const FAQ: Faq[] = [
  { q: "Hur provar jag ett tatueringsmotiv?", a: "Välj ett motiv, tryck på Prova i AR och rikta mobilkameran mot kroppsdelen. Du kan också lägga motivet på ett foto du redan har tagit." },
  { q: "Kostar det något att prova motiv?", a: "Digital provning av motiven i biblioteket är gratis. Köp av ett motiv eller själva tatueringen är separat och avtalas med studion." },
  { q: "Kan jag prova mitt eget motiv?", a: "Ja. Ladda upp en egen bild eller skapa ett textmotiv och prova det på samma sätt." },
  { q: "Visar AR exakt storlek?", a: "Förhandsvisningen hjälper dig bedöma ungefärlig storlek och placering men är ingen mätgaranti. Stäm av slutlig storlek med tatueraren." },
];

const PICKS = (() => {
  const seen = new Set<string>();
  return TATTOOS.filter((t) => (seen.has(t.type) ? false : (seen.add(t.type), true))).slice(0, 9);
})();

export const Route = createFileRoute("/sv/prova-tatueringsmotiv")({
  head: () => seo({ path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "Prova tatueringsmotiv", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Testa motiv"
      h1="Prova tatueringsmotiv på din kropp"
      intro="Välj ett motiv och se det på din egen hud i AR eller på ett foto. Jämför stilar, storlekar och placeringar innan du bestämmer dig."
      primary={{ to: "/library", label: "Välj motiv att prova" }}
      secondary={{ to: "/photo-tryon", label: "Prova på ett foto" }}
      faq={FAQ}
    >
      <h2>Motiv du kan prova direkt</h2>
      <div className="not-prose grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PICKS.map((t) => (
          <figure key={t.id} className="flex flex-col overflow-hidden rounded-lg border-2 border-foreground/80 bg-card">
            <div className="flex aspect-square items-center justify-center bg-paper p-3">
              <img src={t.src} alt={`${t.name} – tatueringsskiss`} loading="lazy" className="max-h-full max-w-full object-contain" />
            </div>
            <figcaption className="flex flex-1 flex-col gap-2 p-2">
              <span className="text-xs">{t.name} · ca {t.widthCm} cm</span>
              <Button asChild className="mt-auto h-auto min-h-12 whitespace-normal bg-accent px-2 py-2 text-center text-xs leading-tight text-accent-foreground"><a href={`/ar?motif=${encodeURIComponent(t.id)}`} className="!no-underline">Prova motivet i AR</a></Button>
            </figcaption>
          </figure>
        ))}
      </div>
      <h2>Så provar du ett motiv</h2>
      <ol>
        <li>Välj motiv i biblioteket eller på en <Link to="/sv/tatueringsmotiv">motivsida</Link>.</li>
        <li>Öppna AR-läget och rikta kameran mot arm, ben eller annan kroppsdel.</li>
        <li>Justera storlek, vinkel och placering tills det känns rätt.</li>
        <li>Spara en bild och jämför med andra motiv eller placeringar.</li>
      </ol>
      <h2>Jämför innan du bokar</h2>
      <p>Prova samma motiv på två platser, eller två motiv på samma plats. Läs mer i <Link to="/sv/tatuering-placering">guiden om placering</Link> och <Link to="/sv/boka-tatuering">skicka en förfrågan till en godkänd studio</Link> när du hittat rätt.</p>
    </SvLanding>
  );
}
