import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Loader2, Mail, Phone } from "lucide-react";
import { sendStudioInterest } from "@/lib/studioInterest.functions";
import { studioInterestSchema } from "@/lib/studioInterest.schema";

export type InterestLang = "en" | "sv";
type Field = "studioName" | "contactName" | "email" | "phone";

/** One copy source for every studio interest entry (interest page + login tab). */
export const interestCopy = {
  en: {
    entry: "Register your interest",
    title: "Register your interest.",
    intro: "Tell us about your studio. We’ll get in touch and help you see whether InkSimulator is right for your work. No account is created at this step.",
    formTitle: "Register your interest",
    fields: { studioName: "Studio name", contactName: "Contact person", email: "Email", phone: "Phone number" },
    placeholders: { studioName: "Your studio", contactName: "Your name", email: "you@studio.com", phone: "+46…" },
    submit: "Request contact",
    required: "Complete all fields with valid contact details.",
    error: "We couldn’t send your request. Please try again or email us directly.",
    sentTitle: "Your interest is registered.",
    sentText: "Thank you. We received your studio details and will contact you.",
    privacy: "Your details are used only to respond to your studio enquiry.",
    call: "Call us", mail: "Email us instead",
    steps: ["You register your interest", "We contact you", "We go through the next steps"] as string[] | null,
  },
  sv: {
    entry: "Anmäl intresse",
    title: "Låt oss prata om din studio.",
    intro: "Lämna dina uppgifter så kontaktar vi dig om hur InkSimulator kan passa din studio. Inget konto skapas i detta steg.",
    formTitle: "Anmäl intresse",
    fields: { studioName: "Studionamn", contactName: "Kontaktperson", email: "E-post", phone: "Telefonnummer" },
    placeholders: { studioName: "Din studio", contactName: "Ditt namn", email: "du@studio.se", phone: "+46" },
    submit: "Skicka intresseanmälan",
    required: "Fyll i alla fält med giltiga kontaktuppgifter.",
    error: "Vi kunde inte skicka din förfrågan. Försök igen eller mejla oss direkt.",
    sentTitle: "Tack!",
    sentText: "Vi har tagit emot din intresseanmälan. Vi kontaktar dig via uppgifterna du lämnade.",
    privacy: "Dina uppgifter används endast för att besvara studions förfrågan.",
    call: "Ring oss", mail: "Mejla oss i stället",
    steps: ["Du anmäler intresse", "Vi kontaktar dig", "Vi går igenom nästa steg"] as string[] | null,
  },
};

export const STUDIO_PHONE_HREF = "tel:+46793288098";
export const STUDIO_MAIL_HREF = "mailto:fredrik@inksimulator.com";

const fields: Field[] = ["studioName", "contactName", "email", "phone"];
const autoComplete: Record<Field, string> = { studioName: "organization", contactName: "name", email: "email", phone: "tel" };

/** Shared form: same validation, recipient (server function) and success rule everywhere. */
export function StudioInterestForm({ lang, headingLevel = 2 }: { lang: InterestLang; headingLevel?: 1 | 2 }) {
  const t = interestCopy[lang];
  const submitInterest = useServerFn(sendStudioInterest);
  const [form, setForm] = useState<Record<Field, string>>({ studioName: "", contactName: "", email: "", phone: "" });
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Field[]>([]);
  const H = headingLevel === 1 ? "h1" : "h2";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const input = { ...form, website };
    const parsed = studioInterestSchema.safeParse(input);
    if (!parsed.success) {
      setInvalid([...new Set(parsed.error.issues.map(i => i.path[0]).filter((p): p is Field => fields.includes(p as Field)))]);
      setError(t.required);
      return;
    }
    setInvalid([]);
    setBusy(true);
    try {
      const result = await submitInterest({ data: input });
      if (!result?.ok) throw new Error("not sent");
      setSent(true); // only after a real successful response
    } catch {
      setError(t.error); // inputs are kept so the visitor can retry
    } finally {
      setBusy(false);
    }
  };

  if (sent) return <div role="status" aria-live="polite">
    <span className="flex size-12 items-center justify-center rounded-full border border-accent text-accent"><Check aria-hidden className="size-6" /></span>
    <H className="mt-6 text-3xl font-medium leading-tight">{t.sentTitle}</H>
    <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t.sentText}</p>
  </div>;

  return <form onSubmit={submit} noValidate aria-labelledby="interest-form-title">
    <H id="interest-form-title" className="text-3xl font-medium leading-tight">{t.formTitle}</H>
    <div className="mt-6 space-y-5">
      {fields.map(field => <div key={field}>
        <label htmlFor={`interest-${field}`} className="field-label text-foreground">{t.fields[field]}</label>
        <input id={`interest-${field}`} name={field} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
          autoComplete={autoComplete[field]} value={form[field]} required
          maxLength={field === "email" ? 254 : field === "phone" ? 40 : 120} placeholder={t.placeholders[field]}
          aria-invalid={invalid.includes(field)} aria-describedby={invalid.includes(field) ? "interest-error" : undefined}
          onChange={e => setForm(c => ({ ...c, [field]: e.target.value }))}
          className="field-input bg-background" />
      </div>)}
    </div>
    <div className="pointer-events-none absolute left-[-9999px]" aria-hidden="true">
      <label htmlFor="interest-website">Website</label><input id="interest-website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
    </div>
    {error && <p id="interest-error" role="alert" className="field-error mt-4">{error}</p>}
    <button type="submit" disabled={busy} aria-busy={busy} className="btn-primary mt-6 w-full justify-between">
      <span className="inline-flex items-center gap-2">{busy && <Loader2 aria-hidden className="size-4 animate-spin" />}{t.submit}</span><ArrowRight aria-hidden className="size-4" />
    </button>
    <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted-foreground">{t.privacy}</p>
    <div className="mt-3 flex flex-wrap gap-x-6">
      <a href={STUDIO_PHONE_HREF} className="btn-link"><Phone aria-hidden className="size-4 text-accent" />{t.call}</a>
      <a href={STUDIO_MAIL_HREF} className="btn-link"><Mail aria-hidden className="size-4 text-accent" />{t.mail}</a>
    </div>
  </form>;
}
