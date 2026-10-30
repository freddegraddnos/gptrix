import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Circle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TATTOO_STYLES } from "@/lib/tattooStyles";
import { onboardingStatus, type OnboardingInput } from "@/lib/studioOnboarding";
import { sendOnboardingTest } from "@/lib/studioOnboarding.functions";
import { useStudioLang } from "@/lib/studioLang";

const images = import.meta.glob("@/assets/styles/*.jpg", { eager: true, import: "default" }) as Record<string, string>;
const styleImage = (s: string) => images[Object.keys(images).find(k => k.endsWith(`/${s.toLowerCase().replace(/\s+/g, "-")}.jpg`)) ?? ""];

const SV_STYLE: Record<string, string> = { Geometric: "Geometriskt", Realism: "Realism", Traditional: "Traditionellt", "Neo-traditional": "Neotraditionellt", "Fine Line": "Fine line", Blackwork: "Blackwork", Dotwork: "Dotwork", Watercolor: "Akvarell", Japanese: "Japanskt", Tribal: "Tribal", Lettering: "Text", Minimalist: "Minimalistiskt" };

const C = {
  sv: {
    title: "Kom igång med din studio", intro: "Tre korta steg. Du kan stänga och fortsätta senare – allt sparas.",
    steps: ["Din studio", "Ditt arbete", "Dina aviseringar"],
    name: "Studionamn", address: "Adress", email: "E-post", phone: "Telefon",
    stylesHelp: "Välj de stilar du gör. Flera val går bra.", search: "Sök stil",
    notifyHelp: "Var vill du få nya kundförfrågningar? Vi har fyllt i dina kontaktuppgifter – ändra om aviseringarna ska till någon annan.",
    byEmail: "E-post", bySms: "SMS", emailTo: "Skicka e-post till", smsTo: "Skicka SMS till (t.ex. +46701234567)",
    save: "Spara och fortsätt", saveNotify: "Spara aviseringar", back: "Tillbaka", test: "Skicka testavisering",
    sDetails: "Uppgifter sparade", sTested: "Avisering testad", sReady: "Redo att ta emot förfrågningar",
    remaining: "Återstår", r: { studio: "studiouppgifter", work: "stilar", notify: "aviseringskanal", test: "testavisering" },
    saved: "Sparat", testOk: "Testavisering skickad – kolla att den kom fram.", testFail: "Testaviseringen kunde inte skickas. Kontrollera mottagaren.",
    badPhone: "Ange mobilnummer med landskod, t.ex. +46701234567.", needChannel: "Välj e-post eller SMS.",
    next: "Lägg upp ditt första motiv", later: "Profilen kan du komplettera senare under Profil.",
    hide: "Dölj", show: "Visa uppstarten",
  },
  en: {
    title: "Get started with your studio", intro: "Three short steps. You can close this and continue later – everything is saved.",
    steps: ["Your studio", "Your work", "Your notifications"],
    name: "Studio name", address: "Address", email: "Email", phone: "Phone",
    stylesHelp: "Choose the styles you do. Pick as many as you like.", search: "Search styles",
    notifyHelp: "Where should new client requests go? We filled in your contact details – change them if someone else should get the notices.",
    byEmail: "Email", bySms: "SMS", emailTo: "Send email to", smsTo: "Send SMS to (e.g. +46701234567)",
    save: "Save and continue", saveNotify: "Save notifications", back: "Back", test: "Send test notification",
    sDetails: "Details saved", sTested: "Notification tested", sReady: "Ready to receive requests",
    remaining: "Remaining", r: { studio: "studio details", work: "styles", notify: "notification channel", test: "test notification" },
    saved: "Saved", testOk: "Test notification sent – check that it arrived.", testFail: "The test notification could not be sent. Check the recipient.",
    badPhone: "Enter a mobile number with country code, e.g. +46701234567.", needChannel: "Choose email or SMS.",
    next: "Upload your first design", later: "You can complete your profile later under Profile.",
    hide: "Hide", show: "Show setup",
  },
};

type Row = OnboardingInput & { onboarding_step: number };

export function StudioOnboarding({ userId, onUploadDesign }: { userId: string; onUploadDesign: () => void }) {
  const [lang] = useStudioLang();
  const t = C[lang === "sv" ? "sv" : "en"];
  const runTest = useServerFn(sendOnboardingTest);
  const [row, setRow] = useState<Row | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(true);
  const [f, setF] = useState({ studio_name: "", address: "", contact_email: "", phone: "", styles: [] as string[], email_on: true, sms_on: false, notify_email: "", notify_phone: "" });

  const load = async () => {
    const { data } = await supabase.from("artist_profiles")
      .select("studio_name, address, contact_email, phone, styles, onboarding_step, onboarding_details_saved_at, notify_email_enabled, notify_sms_enabled, notify_email, notify_phone, notify_test_email_at, notify_test_sms_at")
      .eq("user_id", userId).maybeSingle();
    if (!data) return;
    setRow(data as Row);
    setStep(Math.min(3, Math.max(1, data.onboarding_step ?? 1)));
    setF({
      studio_name: data.studio_name ?? "", address: data.address ?? "", contact_email: data.contact_email ?? "", phone: data.phone ?? "",
      styles: data.styles ?? [], email_on: data.notify_email_enabled, sms_on: data.notify_sms_enabled,
      notify_email: data.notify_email ?? data.contact_email ?? "", notify_phone: data.notify_phone ?? data.phone ?? "",
    });
  };
  useEffect(() => { void load(); }, [userId]);

  const status = useMemo(() => onboardingStatus(row), [row]);
  const shown = useMemo(() => TATTOO_STYLES.filter(s => `${s} ${SV_STYLE[s]}`.toLowerCase().includes(q.trim().toLowerCase())), [q]);

  if (!row) return null;

  const save = async (patch: Record<string, unknown>, nextStep: number) => {
    setBusy(true);
    const { error } = await supabase.from("artist_profiles").update({ ...patch, onboarding_step: nextStep }).eq("user_id", userId);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    toast.success(t.saved);
    await load();
    setStep(Math.min(3, nextStep));
    return true;
  };

  const saveNotify = async () => {
    const phone = f.notify_phone.replace(/[\s-]/g, "");
    if (!f.email_on && !f.sms_on) { toast.error(t.needChannel); return false; }
    if (f.sms_on && !/^\+\d{8,15}$/.test(phone)) { toast.error(t.badPhone); return false; }
    const changedEmail = (f.notify_email.trim() || null) !== (row.notify_email ?? null);
    const changedPhone = (phone || null) !== (row.notify_phone ?? null);
    return save({
      notify_email_enabled: f.email_on, notify_sms_enabled: f.sms_on,
      notify_email: f.notify_email.trim() || null, notify_phone: phone || null,
      onboarding_details_saved_at: new Date().toISOString(),
      // A new recipient must be tested again.
      ...(changedEmail ? { notify_test_email_at: null } : {}),
      ...(changedPhone ? { notify_test_sms_at: null } : {}),
    }, 4);
  };

  const test = async () => {
    if (!(await saveNotify())) return;
    setBusy(true);
    let ok = true;
    for (const channel of [f.email_on && "email", f.sms_on && "sms"].filter(Boolean) as ("email" | "sms")[]) {
      const r = await runTest({ data: { channel, lang: lang === "sv" ? "sv" : "en" } }).catch(() => ({ ok: false }));
      ok = ok && r.ok;
    }
    setBusy(false);
    if (ok) toast.success(t.testOk); else toast.error(t.testFail);
    await load();
  };

  const State = ({ on, label }: { on: boolean; label: string }) => (
    <li className={`flex items-center gap-2 text-sm ${on ? "text-foreground" : "text-muted-foreground"}`}>
      {on ? <Check className="size-4 text-accent" aria-hidden /> : <Circle className="size-4" aria-hidden />}
      <span>{label}</span><span className="sr-only">{on ? "✓" : "–"}</span>
    </li>
  );

  const input = "field-input";
  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:col-span-2" aria-labelledby="onb-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="onb-title" className="font-display text-2xl uppercase">{t.title}</h2>
          {open && <p className="mt-1 text-sm text-muted-foreground">{t.intro}</p>}
        </div>
        <Button variant="ghost" type="button" onClick={() => setOpen(o => !o)} className="min-h-11 text-sm">{open ? t.hide : t.show}</Button>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Status">
        <State on={status.detailsSaved} label={t.sDetails} />
        <State on={status.notificationTested} label={t.sTested} />
        <State on={status.readyForRequests} label={t.sReady} />
      </ul>
      {status.remaining.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{t.remaining}: {status.remaining.map(k => t.r[k]).join(", ")}</p>}

      {open && <>
        <ol className="mt-5 grid grid-cols-3 gap-2" aria-label={t.title}>
          {t.steps.map((s, i) => {
            const done = [status.studioDone, status.workDone, status.notifySaved][i];
            return <li key={s}><button type="button" onClick={() => setStep(i + 1)} aria-current={step === i + 1 ? "step" : undefined}
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm ${step === i + 1 ? "border-accent" : "border-border text-muted-foreground"}`}>
              {done ? <Check className="size-4 shrink-0 text-accent" aria-hidden /> : <span className="font-display">{i + 1}</span>}<span className="truncate">{s}</span>
            </button></li>;
          })}
        </ol>

        {step === 1 && <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void save({ studio_name: f.studio_name.trim(), address: f.address.trim() || null, contact_email: f.contact_email.trim(), phone: f.phone.trim() || null }, 2); }}>
          <label className="block sm:col-span-2"><span className="field-label">{t.name}</span><input required className={input} value={f.studio_name} onChange={e => setF({ ...f, studio_name: e.target.value })} /></label>
          <label className="block sm:col-span-2"><span className="field-label">{t.address}</span><input required className={input} autoComplete="street-address" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></label>
          <label className="block"><span className="field-label">{t.email}</span><input required type="email" className={input} value={f.contact_email} onChange={e => setF({ ...f, contact_email: e.target.value })} /></label>
          <label className="block"><span className="field-label">{t.phone}</span><input type="tel" className={input} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
          <div className="sm:col-span-2"><Button type="submit" disabled={busy} className="btn-primary h-auto">{busy && <Loader2 className="size-4 animate-spin" />}{t.save}</Button></div>
        </form>}

        {step === 2 && <div className="mt-5">
          <p className="text-sm text-muted-foreground">{t.stylesHelp}</p>
          <label className="relative mt-3 block max-w-sm"><span className="sr-only">{t.search}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input className={`${input} pl-9`} placeholder={t.search} value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map(s => {
              const on = f.styles.includes(s);
              return <button key={s} type="button" aria-pressed={on} onClick={() => setF({ ...f, styles: on ? f.styles.filter(x => x !== s) : [...f.styles, s] })}
                className={`overflow-hidden rounded-xl border-2 text-left ${on ? "border-accent" : "border-border"}`}>
                <img src={styleImage(s)} alt="" loading="lazy" width={816} height={816} className="aspect-square w-full bg-stencil-paper object-cover" />
                <span className="flex min-h-11 items-center justify-between gap-2 px-3 text-sm">{lang === "sv" ? SV_STYLE[s] : s}{on && <Check className="size-4 text-accent" aria-hidden />}</span>
              </button>;
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)} className="min-h-11">{t.back}</Button>
            <Button type="button" disabled={busy || f.styles.length === 0} onClick={() => void save({ styles: f.styles }, 3)} className="btn-primary h-auto">{t.save}</Button>
          </div>
        </div>}

        {step === 3 && <div className="mt-5 space-y-4">
          <p className="text-sm text-muted-foreground">{t.notifyHelp}</p>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5 accent-[var(--accent)]" checked={f.email_on} onChange={e => setF({ ...f, email_on: e.target.checked })} />{t.byEmail}</label>
          {f.email_on && <label className="block max-w-md"><span className="field-label">{t.emailTo}</span><input type="email" className={input} value={f.notify_email} onChange={e => setF({ ...f, notify_email: e.target.value })} /></label>}
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5 accent-[var(--accent)]" checked={f.sms_on} onChange={e => setF({ ...f, sms_on: e.target.checked })} />{t.bySms}</label>
          {f.sms_on && <label className="block max-w-md"><span className="field-label">{t.smsTo}</span><input type="tel" className={input} value={f.notify_phone} onChange={e => setF({ ...f, notify_phone: e.target.value })} /></label>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(2)} className="min-h-11">{t.back}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void saveNotify()} className="min-h-11">{t.saveNotify}</Button>
            <Button type="button" disabled={busy} onClick={() => void test()} className="btn-primary h-auto">{busy && <Loader2 className="size-4 animate-spin" />}{t.test}</Button>
          </div>
        </div>}
      </>}

      {status.detailsSaved && <div className="mt-6 border-t border-border pt-5">
        <Button type="button" onClick={onUploadDesign} className="btn-primary h-auto w-full sm:w-auto">{t.next} →</Button>
        <p className="mt-2 text-sm text-muted-foreground">{t.later}</p>
      </div>}
    </section>
  );
}
