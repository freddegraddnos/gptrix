import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowUpRight, Check, Loader2, Mail, Phone, Store, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudioInterestForm, interestCopy } from "@/components/StudioInterestForm";
import { StudioTrackHeader } from "@/components/StudioTrackHeader";
import { sendStudioInterest } from "@/lib/studioInterest.functions";
import { studioInterestSchema } from "@/lib/studioInterest.schema";
import { usePublicStudioLang } from "@/lib/publicStudioLang";

type Lang = "en" | "sv";
type Field = "studioName" | "contactName" | "email" | "phone";

const copy = {
  en: {
    eyebrow: "STUDIO INTEREST",
    title: "Register your interest.",
    intro: "Tell us about your studio. We’ll get in touch and help you see whether InkSimulator is right for your work.",
    fields: { studioName: "Studio name", contactName: "Contact person", email: "Email", phone: "Phone number" },
    placeholders: { studioName: "Your studio", contactName: "Your name", email: "you@studio.com", phone: "+46…" },
    submit: "Request contact",
    required: "Complete all fields with valid contact details.",
    error: "We couldn’t send your request. Please try again or email us directly.",
    sent: "Your interest is registered.",
    sentText: "Thank you. We received your studio details and will contact you.",
    back: "Back to InkSimulator for studios",
    mail: "Email us instead",
    privacy: "Your details are used only to respond to your studio enquiry.",
  },
  sv: {
    eyebrow: "INTRESSEANMÄLAN FÖR STUDIO",
    title: "Anmäl intresse.",
    intro: "Berätta om din studio. Vi kontaktar dig och hjälper dig se om InkSimulator passar ert arbete.",
    fields: { studioName: "Studionamn", contactName: "Kontaktperson", email: "E-post", phone: "Telefonnummer" },
    placeholders: { studioName: "Din studio", contactName: "Ditt namn", email: "du@studio.se", phone: "+46…" },
    submit: "Be om kontakt",
    required: "Fyll i alla fält med giltiga kontaktuppgifter.",
    error: "Vi kunde inte skicka din förfrågan. Försök igen eller mejla oss direkt.",
    sent: "Din intresseanmälan är registrerad.",
    sentText: "Tack. Vi har tagit emot studions uppgifter och kontaktar dig.",
    back: "Tillbaka till InkSimulator för studios",
    mail: "Mejla oss i stället",
    privacy: "Dina uppgifter används endast för att besvara studions förfrågan.",
  },
} satisfies Record<Lang, {
  eyebrow: string; title: string; intro: string; fields: Record<Field, string>; placeholders: Record<Field, string>;
  submit: string; required: string; error: string; sent: string; sentText: string; back: string; mail: string; privacy: string;
}>;

const icons = { studioName: Store, contactName: UserRound, email: Mail, phone: Phone };

export function StudioInterestPage({ lang, preview = false, onPreviewLang }: { lang: Lang; preview?: boolean; onPreviewLang?: (lang: Lang) => void }) {
  const t = copy[lang];
  const f = interestCopy[lang];
  const submitInterest = useServerFn(sendStudioInterest);
  const navigate = useNavigate();
  const [preferredLang, setLang] = usePublicStudioLang(lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    return () => { document.documentElement.lang = "en"; };
  }, [lang]);
  useEffect(() => {
    if (preview) return;
    if (lang === "en" && preferredLang === "sv") void navigate({ to: "/sv/for-studios/interest", replace: true });
  }, [lang, preferredLang, navigate, preview]);

  const chooseLanguage = (next: Lang) => {
    if (preview && onPreviewLang) { onPreviewLang(next); return; }
    setLang(next);
    void navigate({ to: next === "sv" ? "/sv/for-studios/interest" : "/for-studios/interest" });
  };
  return <main className={`studio-time-page ds-preview min-h-screen bg-background font-mono text-foreground`} lang={lang}>
    <StudioTrackHeader lang={lang} onLang={chooseLanguage} theme back={{ to: lang === "sv" ? "/sv/for-studios" : "/for-studios", label: t.back }} />
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 pb-16 pt-6 md:px-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-start lg:gap-16">
      <section className="min-w-0">
        <p className="text-[0.75rem] uppercase leading-relaxed text-accent">{t.eyebrow}</p>
        <h1 className="studio-time-heading mt-3 max-w-[14ch] font-display text-4xl uppercase leading-[1.04] sm:text-5xl lg:text-6xl">{f.title}</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{f.intro}</p>
        {f.steps && <ol className="mt-8 hidden space-y-4 lg:block">{f.steps.map((step, i) => <li key={step} className="flex items-center gap-4 text-base">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full border ${i === 0 ? "border-accent" : "border-border"}`}>{i + 1}</span>{step}</li>)}</ol>}
      </section>
      <section className="ds-card w-full rounded-3xl border border-accent/60 bg-card p-5 sm:p-8">
        <StudioInterestForm lang={lang} />
      </section>
      {f.steps && <ol className="space-y-4 lg:hidden">{f.steps.map((step, i) => <li key={step} className="flex items-center gap-4 text-base">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full border ${i === 0 ? "border-accent" : "border-border"}`}>{i + 1}</span>{step}</li>)}</ol>}
    </div>
  </main>;
}