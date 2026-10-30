import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublicStudioLang } from "@/lib/publicStudioLang";
import { seo } from "@/lib/seo";
import { StudioTrackHeader } from "@/components/StudioTrackHeader";
import { STUDIO_TRIAL_PRESENTATION } from "@/lib/studioTrialPresentation";

const copy = {
  en: {
    back: "For studios", switch: "Svenska", title: "Studio pricing", lead: "Free trial throughout 2026 with no fixed studio fee or commission.",
    tattoo: "Tattoo payments", design: "Design sales", fee: "InkSimulator fee", keep: "Studio keeps", example: "Example",
    tattooExample: "During the 2026 trial, InkSimulator charges no platform commission on tattoo payments.",
    designExample: "During the 2026 trial, InkSimulator charges no platform commission on design sales (Pilot).",
    noFixed: "Studio subscription", noFixedText: "Free trial throughout 2026 with no fixed studio fee or commission. SMS notifications, the Fortnox connection and Posture Pro (worth 999 kr/year) are all included in the plan.",
    note: "These terms apply to the trial throughout 2026. A Fortnox subscription is purchased separately.",
    contact: "Call about studio accounts", guide: "Explore the studio guide", subtitle: "Clear terms before you get started.", sek: "Prices shown in SEK",
  },
  sv: {
    back: "För studios", switch: "English", title: "Priser för studios", lead: "Gratis provperiod under hela 2026 utan fast studioavgift eller provision.",
    tattoo: "Tatueringsbetalningar", design: "Motivförsäljning", fee: "InkSimulators provision", keep: "Studion behåller", example: "Exempel",
    tattooExample: "Under provperioden 2026 tar InkSimulator ingen plattformsprovision på tatueringsbetalningar.",
    designExample: "Under provperioden 2026 tar InkSimulator ingen plattformsprovision på motivförsäljning (Pilot).",
    noFixed: "Studioabonnemang", noFixedText: "Gratis provperiod under hela 2026 utan fast studioavgift eller provision. SMS-aviseringar, Fortnox-kopplingen och Posture Pro (värde 999 kr/år) ingår i abonnemanget.",
    note: "Villkoren gäller provperioden under hela 2026. Fortnox-abonnemang köps separat.",
    contact: "Ring om studiokonto", guide: "Läs studioguiden", subtitle: "Tydliga villkor innan du börjar.", sek: "Priser anges i SEK",
  },
} as const;

function Pricing() {
  const [lang, setLang] = usePublicStudioLang();
  const t = copy[lang];
  return (
    <main lang={lang} className="min-h-screen bg-paper text-paper-ink font-mono">
      <StudioTrackHeader lang={lang} onLang={setLang} theme back={{ to: lang === "sv" ? "/sv/for-studios" : "/for-studios", label: t.back }} />
      <header className="border-y-2 border-paper-ink bg-ink px-5 py-12 text-foreground md:py-20">
        <div className="mx-auto max-w-6xl"><p className="mb-5 text-xs uppercase text-accent">InkSimulator · {t.subtitle}</p><h1 className="font-display text-5xl uppercase leading-none md:text-7xl">{t.title}</h1><p className="mt-6 max-w-2xl text-base leading-relaxed md:text-lg">{t.lead}</p><p className="mt-3 text-xs uppercase text-accent">{t.sek}</p></div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-12 md:py-20">
        <div className="grid gap-8 md:grid-cols-2">
          {([
            { title: t.tattoo, rate: `${STUDIO_TRIAL_PRESENTATION.commissionPercent} %`, example: t.tattooExample },
            { title: t.design, rate: `${STUDIO_TRIAL_PRESENTATION.commissionPercent} %`, example: t.designExample },
          ] as const).map((item) => (
            <section key={item.title} className="border-t-2 border-paper-ink pt-5">
              <h2 className="font-display text-3xl uppercase md:text-4xl">{item.title}</h2>
              <div className="mt-6 flex items-end justify-between border-b border-paper-ink pb-5"><span className="text-xs uppercase">{t.fee}</span><strong className="font-display text-5xl">{item.rate}</strong></div>
              <p className="mt-6 text-sm leading-relaxed">{item.example}</p>
            </section>
          ))}
        </div>
        <section className="mt-14 border-t-2 border-paper-ink pt-6"><h2 className="font-display text-3xl uppercase">{t.noFixed}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed">{t.noFixedText}</p><p className="mt-5 max-w-2xl text-xs text-paper-ink/70">{t.note}</p></section>
        <div className="mt-12 flex flex-wrap gap-4 border-t border-paper-ink pt-6">
          <Button asChild className="h-auto min-h-11 max-w-full whitespace-normal break-words rounded-none text-left"><a href="tel:+46793288098"><Phone className="size-4" />{t.contact} · +46 79 328 80 98</a></Button>
          <Button asChild variant="outline" className="rounded-none border-paper-ink bg-paper text-paper-ink hover:bg-paper hover:text-paper-ink"><Link to={lang === "sv" ? "/sv/studio-guide/setup" : "/studio-guide/setup"}>{t.guide}<ArrowRight className="size-4" /></Link></Button>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () => seo({ path: "/pricing", title: "Studio Pricing — Free Trial Throughout 2026 | InkSimulator", description: "InkSimulator studio pricing: free trial throughout 2026 with no fixed studio fee or commission on bookings and design sales. Prices shown in SEK.", breadcrumb: "Pricing", jsonLd: [{
    "@context": "https://schema.org",
    "@type": "Service",
    name: "InkSimulator studio plan",
    serviceType: "Tattoo studio booking and design sales platform",
    url: "https://www.inksimulator.com/pricing",
    provider: { "@id": "https://www.inksimulator.com/#organization" },
    areaServed: "SE",
    offers: [
      { "@type": "Offer", name: "Studio plan, free trial throughout 2026", price: "0", priceCurrency: "SEK", validThrough: "2026-12-31" },
      { "@type": "Offer", name: "No commission during the 2026 trial", description: "No commission on bookings and design sales during the trial throughout 2026.", price: "0", priceCurrency: "SEK", validThrough: "2026-12-31" },
    ],
  }] }),
});