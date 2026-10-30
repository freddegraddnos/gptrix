import { createFileRoute, Link } from "@tanstack/react-router";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";
import { seo } from "@/lib/seo";

const PATH = "/sv/romerska-siffror-tatuering";
const FAQ: Faq[] = [
  { q: "Hur skriver jag ett datum med romerska siffror?", a: "Omvandla dag, månad och år var för sig och välj tydliga avskiljare. Exempel: 14 oktober 2026 kan skrivas XIV · X · MMXXVI. Kontrollera varje del innan du tatuerar den." },
  { q: "Vilket typsnitt passar romerska siffror?", a: "En tydlig serif ger ett klassiskt uttryck; ett enkelt typsnitt kan kännas mer avskalat. Jämför hur I, V och X ser ut tillsammans och kontrollera att de inte flyter ihop i din önskade storlek." },
  { q: "Kan textgeneratorn omvandla datum automatiskt?", a: "Den här guiden visar exempel, inte en automatisk datumomvandlare. Skriv in dina kontrollerade siffror i textgeneratorn, välj typsnitt och prova placeringen." },
  { q: "Kan jag prova siffrorna på handleden?", a: "Ja, skapa texten och prova den i AR eller på ett foto. Långa årtal kan behöva mer plats än handleden erbjuder; låt tatueraren bedöma storlek och avstånd." },
];

export const Route = createFileRoute("/sv/romerska-siffror-tatuering")({
  head: () => seo({ path: PATH, title: "Romerska siffror tatuering – datum, typsnitt & AR", description: "Skapa en tatuering med romerska siffror: exempel på datum och årtal, tips om typsnitt och placering på handled. Prova texten i AR eller på foto.", lang: "sv", breadcrumb: "Romerska siffror", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return <SvLanding current={PATH} kicker="Text och datum" h1="Romerska siffror tatuering" intro="Ett födelsedatum, ett årtal eller en viktig dag kan bli ett personligt textmotiv. Kontrollera siffrorna först, jämför sedan typsnitt och se hur raden passar på din kropp." primary={{ to: "/tattoo-font-generator", label: "Skapa ditt textmotiv" }} secondary={{ to: "/photo-tryon", label: "Prova på ett foto" }} faq={FAQ}>
    <h2>Från datum till textmotiv</h2>
    <ol><li>Skriv datumet i vanlig form och bestäm ordningen: dag, månad, år.</li><li>Omvandla varje del och dubbelkontrollera med en oberoende källa.</li><li>Klistra in siffrorna i textgeneratorn och välj ett lättläst typsnitt.</li><li>Jämför rak, lodrät eller cirkelformad layout.</li><li>Prova placeringen och be tatueraren kontrollera siffror, teckenavstånd och storlek.</li></ol>
    <h2>Exempel på siffror och årtal</h2>
    <p className="text-sm">Exemplen är inspiration, inte färdiga personliga datum.</p>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-border"><th className="py-3">Tal</th><th>Romerska siffror</th></tr></thead><tbody>{[["4", "IV"], ["9", "IX"], ["14", "XIV"], ["1990", "MCMXC"], ["2000", "MM"], ["2026", "MMXXVI"]].map(([number, roman]) => <tr key={number} className="border-b border-border"><td className="py-3">{number}</td><td className="font-mono">{roman}</td></tr>)}</tbody></table></div>
    <h2>Handled, underarm eller nyckelben?</h2>
    <p>En kort rad kan fungera på handleden. Ett helt datum får ofta mer luft på underarmen eller längs nyckelbenet. Prova båda riktningarna och lämna utrymme mellan tecknen; skärmen kan visa finare detaljer än vad som fungerar som läkt tatuering.</p>
    <h2>Typsnitt och läsbarhet</h2>
    <p>Jämför samma datum i flera typsnitt, inte olika datum i olika stilar. Kontrollera särskilt att I inte ser ut som en avskiljare. Läs också om <Link to="/sv/tatuering-text">texttatuering och typsnitt</Link> och <Link to="/sv/tatuering-placering">placering och storlek</Link>.</p>
  </SvLanding>;
}