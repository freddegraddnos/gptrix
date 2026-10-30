import { Link } from "@tanstack/react-router";

export type SeoInfoSection = { h: string; p: string };
export type SeoInfoLink = { to: string; label: string };

/** Crawlable explanatory text placed under app tools so search engines understand each page. */
export function SeoInfo({
  title,
  intro,
  sections,
  links,
}: {
  title: string;
  intro: string;
  sections: SeoInfoSection[];
  links: SeoInfoLink[];
}) {
  return (
    <section className="mt-12 border-t border-border pt-8 pb-4 text-sm text-muted-foreground">
      <h2 className="font-display text-2xl uppercase text-foreground">{title}</h2>
      <p className="mt-3 leading-relaxed">{intro}</p>
      {sections.map((s) => (
        <div key={s.h} className="mt-5">
          <h3 className="font-bold text-foreground">{s.h}</h3>
          <p className="mt-1 leading-relaxed">{s.p}</p>
        </div>
      ))}
      <nav aria-label="Related tools" className="mt-6 flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to as never}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-foreground hover:border-accent"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
