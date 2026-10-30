import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export type Faq = { q: string; a: string };

export const SV_PAGES = [
  { to: "/sv/prova-tatuering", label: "Prova tatuering i AR" },
  { to: "/sv/tatuering-text", label: "Tatuering med text" },
  { to: "/sv/texttatuering-ai-ar", label: "Texttatuering med AI + AR" },
  { to: "/sv/ai-tatuering", label: "AI-tatuering" },
  { to: "/sv/skapa-tatuering", label: "Skapa tatuering" },
  { to: "/sv/skapa-tatueringsmotiv", label: "Skapa tatueringsmotiv" },
  { to: "/sv/cover-up-tatuering", label: "Cover up tatuering" },
  { to: "/sv/prova-tatueringsmotiv", label: "Prova tatueringsmotiv" },
  { to: "/sv/romerska-siffror-tatuering", label: "Romerska siffror" },
  { to: "/sv/fineline-tatuering", label: "Fineline tatuering" },
  { to: "/sv/realistisk-tatuering", label: "Realistisk tatuering" },
  { to: "/sv/djur-tatuering", label: "Djur tatuering" },
  { to: "/sv/tatueringsmotiv", label: "Tatueringsmotiv" },
  { to: "/sv/tatuering-placering", label: "Placering och storlek" },
  { to: "/sv/pris-tatuering", label: "Vad kostar en tatuering" },
  { to: "/sv/boka-tatuering", label: "Boka tatuering" },
] as const;

export function faqLd(faq: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "sv",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

const btn = "h-auto min-h-12 whitespace-normal px-5 py-3 text-center text-sm";

export function SvLanding({
  current,
  kicker,
  h1,
  intro,
  primary,
  secondary,
  children,
  faq,
}: {
  current: string;
  kicker: string;
  h1: string;
  intro: string;
  primary: { to: string; label: string };
  secondary?: { to: string; label: string };
  children: ReactNode;
  faq: Faq[];
}) {
  return (
    <main lang="sv" className="mx-auto max-w-2xl px-5 py-10 text-foreground">
      <p className="text-xs uppercase tracking-widest text-accent">{kicker}</p>
      <h1 className="mt-2 font-display text-4xl uppercase leading-none md:text-5xl">{h1}</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">{intro}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild className={`${btn} bg-accent text-accent-foreground`}><a href={primary.to}>
          {primary.label}
        </a></Button>
        {secondary && (
          <Button asChild variant="outline" className={btn}><a href={secondary.to}>
            {secondary.label}
          </a></Button>
        )}
      </div>
      <div className="sv-landing-body mt-4 space-y-3 leading-relaxed text-muted-foreground [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:uppercase [&_h2]:text-foreground [&_a]:underline [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
      <h2 className="mt-10 font-display text-2xl uppercase">Vanliga frågor</h2>
      <div className="mt-3 space-y-4">
        {faq.map((f) => (
          <div key={f.q}>
            <h3 className="font-bold">{f.q}</h3>
            <p className="mt-1 text-muted-foreground">{f.a}</p>
          </div>
        ))}
      </div>
      <nav aria-label="Fler guider" className="mt-12 border-t border-border pt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Mer om tatueringar</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {SV_PAGES.filter((p) => p.to !== current).map((p) => (
            <li key={p.to}>
              <Link to={p.to} className="underline">{p.label}</Link>
            </li>
          ))}
          <li><Link to="/studios" className="underline">Studios</Link></li>
        </ul>
      </nav>
    </main>
  );
}
