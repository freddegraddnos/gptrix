import { seo } from "@/lib/seo";
import { SvLanding, faqLd } from "@/components/SvLanding";
import { MOTIF_PAGES, type MotifPage } from "@/lib/svMotifPages";
import { motifGallery } from "@/lib/svMotifGallery";
import { Button } from "@/components/ui/button";

export function motifPage(slug: string): MotifPage {
  const p = MOTIF_PAGES.find((m) => m.slug === slug);
  if (!p) throw new Error(`Unknown motif page ${slug}`);
  return p;
}

export function motifHead(slug: string) {
  const p = motifPage(slug);
  return seo({ path: `/sv/${p.slug}`, title: p.title, description: p.desc, lang: "sv", breadcrumb: p.label, jsonLd: [faqLd(p.faq)] });
}

export function SvMotifLanding({ slug }: { slug: string }) {
  const p = motifPage(slug);
  const gallery = motifGallery(slug);
  return (
    <SvLanding
      current={`/sv/${p.slug}`}
      kicker="Motiv"
      h1={p.h1}
      intro={p.intro}
      primary={{ to: "/library", label: "Bläddra i motivbiblioteket" }}
      secondary={{ to: "/ar", label: "Prova i AR" }}
      faq={p.faq}
    >
      {gallery.length > 0 && (
        <>
          <h2>Färdiga skisser att prova</h2>
          <div className="not-prose grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((t) => (
              <figure key={t.id} className="flex flex-col overflow-hidden rounded-lg border-2 border-foreground/80 bg-card">
                <div className="flex aspect-square items-center justify-center bg-paper p-3">
                  <img src={t.src} alt={`${t.name} – tatueringsskiss`} loading="lazy" className="max-h-full max-w-full object-contain" />
                </div>
                <figcaption className="flex flex-1 flex-col gap-2 p-2">
                  <span className="text-xs">{t.name} · ca {t.widthCm} cm</span>
                  <Button asChild className="mt-auto h-auto min-h-12 whitespace-normal bg-accent px-2 py-2 text-center text-xs leading-tight text-accent-foreground [&_a]:no-underline"><a
                    href={`/ar?motif=${encodeURIComponent(t.id)}`}
                    className="!no-underline"
                  >
                    Prova detta motiv direkt på din arm i AR
                  </a></Button>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
      <h2>Idéer</h2>
      <ul>
        {p.ideas.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {p.meaning && (
        <>
          <h2>Betydelse</h2>
          <p>{p.meaning}</p>
        </>
      )}
      <h2>Placering och storlek</h2>
      <p>
        {p.placement} Läs mer i <a href="/sv/tatuering-placering">guiden om placering</a>.
      </p>
      <h2>Prova innan du bokar</h2>
      <p>
        Hitta ett motiv i <a href="/library">biblioteket</a>, prova det <a href="/photo-tryon">på ett foto</a> eller
        skapa ett eget utkast med <a href="/sv/ai-tatuering">AI-tatuering</a>. När du är nöjd kan du{" "}
        <a href="/sv/boka-tatuering">skicka en förfrågan till en studio</a>.
      </p>
      <h2>Fler motiv</h2>
      <ul>
        {MOTIF_PAGES.filter((m) => m.slug !== p.slug).map((m) => (
          <li key={m.slug}>
            <a href={`/sv/${m.slug}`}>{m.label}</a>
          </li>
        ))}
      </ul>
    </SvLanding>
  );
}
