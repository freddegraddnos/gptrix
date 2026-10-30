import { track } from "@/lib/track";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";

type Studio = { handle: string; name: string; area: string };
export type City = { slug: string; name: string; studios: Studio[]; nearby?: string };

// Approved, manually added studios (artist_profiles: status + approval_status approved), 2026-10-30.
export const CITIES: City[] = [
  {
    slug: "stockholm",
    name: "Stockholm",
    studios: [
      { handle: "mushroomstattoo", name: "Mushrooms tattoo", area: "Hagagatan, Stockholm" },
      { handle: "davincistudio", name: "Davinci Studio", area: "Södermalm, Stockholm" },
      { handle: "kontrastinkgallery", name: "Kontrast ink gallery", area: "Södermalm, Stockholm" },
      { handle: "beyondinkstudio", name: "Beyond ink studio", area: "Kungsholmen, Stockholm" },
      { handle: "studioblancotattoo", name: "Studio blanco tattoo", area: "Ringvägen, Stockholm" },
      { handle: "affetattoo", name: "AFFE TATTOO", area: "Bromma" },
      { handle: "idaleinoinknart", name: "Ida Leino ink n art", area: "Bromma" },
      { handle: "lillagatanstatuering", name: "Lilla Gatans Tatuering", area: "Solna" },
      { handle: "roslagenstattooclinic", name: "Roslagens Tattoo Clinic", area: "Norrtälje" },
    ],
  },
  {
    slug: "goteborg",
    name: "Göteborg",
    studios: [
      { handle: "gothenburgtattoo", name: "Gothenburg Tattoo", area: "Göteborg" },
      { handle: "valhallaink", name: "Valhalla Ink", area: "Göteborg" },
      { handle: "pistolero", name: "Pistolero", area: "Borås" },
    ],
  },
  {
    slug: "malmo",
    name: "Malmö",
    studios: [
      { handle: "velvetbyc", name: "Velvet by C", area: "Malmö" },
      { handle: "daltonstattoo", name: "Dalton's Tattoo", area: "Malmö" },
      { handle: "liztattoo", name: "Liz tattoo", area: "Malmö" },
    ],
    nearby: "helsingborg",
  },
  {
    slug: "linkoping",
    name: "Linköping",
    studios: [
      { handle: "artfigge", name: "Artfigge", area: "Linköping" },
      { handle: "aajttattoo", name: "AAJT Tattoo", area: "Linköping" },
    ],
  },
  {
    slug: "helsingborg",
    name: "Helsingborg",
    studios: [
      { handle: "anubisinktattoo", name: "Anubis Ink Tattoo", area: "Helsingborg" },
      { handle: "crookedmoontattoo", name: "Crooked Moon Tattoo", area: "Helsingborg" },
    ],
    nearby: "malmo",
  },
];

const bySlug = (s: string) => CITIES.find((c) => c.slug === s)!;

function faqFor(c: City): Faq[] {
  return [
    { q: `Hur hittar jag en tatuerare i ${c.name}?`, a: `Se de anslutna studiorna i ${c.name} här, öppna studions sida och skicka en förfrågan med motiv, placering och storlek.` },
    { q: "Kan jag prova motivet innan jag bokar?", a: "Ja. Prova motivet i AR med mobilkameran eller på ett foto och skicka med förhandsvisningen i förfrågan." },
    { q: `Vad kostar en tatuering i ${c.name}?`, a: "Priset och eventuell deposition sätts av varje studio och beror på storlek, detaljer och placering. Studion svarar med pris innan du bekräftar." },
    { q: "Måste jag vara 18 år?", a: "Ja. Du behöver vara 18 år eller äldre för att boka tatuering via InkSimulator." },
  ];
}

export function cityHead(slug: string) {
  const c = bySlug(slug);
  const faq = faqFor(c);
  return seo({
    path: `/sv/tatuerare-${c.slug}`,
    title: `Tatuerare ${c.name} – tatueringsstudios & boka tatuering | InkSimulator`,
    description: `Hitta tatuerare i ${c.name}: ${c.studios.length} godkända tatueringsstudios. Prova motivet på huden i AR och skicka förfrågan direkt till studion.`,
    lang: "sv",
    breadcrumb: `Tatuerare ${c.name}`,
    jsonLd: [
      faqLd(faq),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `Tatuerare i ${c.name}`,
        itemListElement: c.studios.map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: s.name,
          url: `https://www.inksimulator.com/${s.handle}`,
        })),
      },
    ],
  });
}

export function SvCityPage({ slug }: { slug: string }) {
  const c = bySlug(slug);
  const path = `/sv/tatuerare-${c.slug}`;
  const nearby = c.nearby ? bySlug(c.nearby) : null;
  return (
    <SvLanding
      current={path}
      kicker={`Tatuerare ${c.name}`}
      h1={`Tatuerare i ${c.name}`}
      intro={`Här är de tatueringsstudios i ${c.name} med omnejd som är anslutna till InkSimulator. Prova motivet på din egen hud först och skicka förhandsvisningen med din förfrågan.`}
      primary={{ to: "/ar", label: "Prova motivet först" }}
      secondary={{ to: "/studios", label: "Alla studios" }}
      faq={faqFor(c)}
    >
      <h2>Tatueringsstudios i {c.name}</h2>
      <ul>
        {c.studios.map((s) => (
          <li key={s.handle}>
            <a href={`/${s.handle}`} onClick={() => track("city_studio_clicked", { handle: s.handle, city: c.slug })}>{s.name}</a> – {s.area}
          </li>
        ))}
      </ul>
      <p>Alla studios är manuellt granskade och godkända innan de visas.</p>
      <h2>Så bokar du tatuering i {c.name}</h2>
      <ol>
        <li>Prova motivet i AR eller på ett foto.</li>
        <li>Välj en studio i listan och öppna studions sida.</li>
        <li>Skicka förfrågan med bild, placering och storlek.</li>
        <li>Studion svarar med tid, pris och eventuell deposition.</li>
      </ol>
      <h2>Inför besöket</h2>
      <p>
        Läs om <a href="/sv/tatuering-placering">placering och storlek</a>, vad som påverkar{" "}
        <a href="/sv/pris-tatuering">priset</a> eller hämta idéer bland{" "}
        <a href="/sv/tatueringsmotiv">tatueringsmotiv</a>.
      </p>
      <h2>Tatuerare i andra städer</h2>
      <p>
        {CITIES.filter((o) => o.slug !== c.slug).map((o, i, arr) => (
          <span key={o.slug}>
            <a href={`/sv/tatuerare-${o.slug}`}>Tatuerare {o.name}</a>
            {o.slug === nearby?.slug ? " (nära)" : ""}
            {i < arr.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
    </SvLanding>
  );
}
