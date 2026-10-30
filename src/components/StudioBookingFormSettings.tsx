import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseQuestions, type IntakeQuestion } from "@/lib/bookingIntake";
import { t, useStudioLang } from "@/lib/studioLang";

import { tx, useUiLang } from "@/lib/uiLang";
const c = {
  title: { en: "Booking form", sv: "Bokningsformulär" },
  intro: {
    en: "Greeting and questions the customer sees when booking. The greeting and their answers are emailed to them.",
    sv: "Hälsning och frågor som kunden ser vid bokning. Hälsningen och svaren mailas till kunden.",
  },
  greeting: { en: "Greeting", sv: "Hälsning" },
  greetingPh: { en: "Thanks for your request! We reply within 48 h.", sv: "Tack för din förfrågan! Vi svarar inom 48 h." },
  questions: { en: "Questions", sv: "Frågor" },
  add: { en: "Add question", sv: "Lägg till fråga" },
  text: { en: "Free text", sv: "Fritext" },
  yesno: { en: "Yes/No", sv: "Ja/Nej" },
  required: { en: "Required", sv: "Obligatorisk" },
  save: { en: "Save", sv: "Spara" },
  saved: { en: "Booking form saved", sv: "Bokningsformuläret sparat" },
  preview: { en: "Preview for the customer", sv: "Förhandsvisning för kunden" },
};

export function StudioBookingFormSettings({ userId }: { userId: string }) {
  useUiLang();
  const [lang] = useStudioLang();
  const [greeting, setGreeting] = useState("");
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from("artist_profiles")
      .select("booking_greeting, booking_questions")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setGreeting(data?.booking_greeting ?? "");
        setQuestions(parseQuestions(data?.booking_questions));
      });
  }, [userId]);

  const update = (i: number, patch: Partial<IntakeQuestion>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: number) =>
    setQuestions((qs) => {
      const n = [...qs];
      const j = i + d;
      if (j < 0 || j >= n.length) return qs;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  const save = async () => {
    setBusy(true);
    const clean = questions.filter((q) => q.text.trim()).map((q) => ({ ...q, text: q.text.trim().slice(0, 200) }));
    const { error } = await supabase
      .from("artist_profiles")
      .update({ booking_greeting: greeting.trim().slice(0, 1000) || null, booking_questions: clean })
      .eq("user_id", userId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setQuestions(clean);
      toast.success(t(c.saved, lang));
    }
  };

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-border p-4">
      <div>
        <h3 className="font-display text-lg uppercase">{t(c.title, lang)}</h3>
        <p className="text-xs text-muted-foreground">{t(c.intro, lang)}</p>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-bold">{t(c.greeting, lang)}</span>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={t(c.greetingPh, lang)}
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
        />
      </label>
      <div className="space-y-2">
        <p className="text-xs font-bold">{t(c.questions, lang)}</p>
        {questions.map((q, i) => (
          <div key={q.id} className="space-y-2 rounded-md border border-border p-2">
            <input
              value={q.text}
              onChange={(e) => update(i, { text: e.target.value })}
              maxLength={200}
              className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={q.type}
                onChange={(e) => update(i, { type: e.target.value as IntakeQuestion["type"] })}
                className="h-9 rounded-md border border-border bg-background px-2"
              >
                <option value="text">{t(c.text, lang)}</option>
                <option value="yesno">{t(c.yesno, lang)}</option>
              </select>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} />
                {t(c.required, lang)}
              </label>
              <div className="ml-auto flex gap-1">
                <button type="button" aria-label={tx("Up")} onClick={() => move(i, -1)} className="grid size-9 place-items-center rounded-md border border-border"><ArrowUp className="size-4" /></button>
                <button type="button" aria-label={tx("Down")} onClick={() => move(i, 1)} className="grid size-9 place-items-center rounded-md border border-border"><ArrowDown className="size-4" /></button>
                <button type="button" aria-label={tx("Delete")} onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-md border border-border text-destructive"><Trash2 className="size-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {questions.length < 10 && (
          <button
            type="button"
            onClick={() => setQuestions((qs) => [...qs, { id: crypto.randomUUID(), text: "", type: "text", required: false }])}
            className="flex h-10 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-xs font-bold"
          >
            <Plus className="size-4" /> {t(c.add, lang)}
          </button>
        )}
      </div>
      {(greeting.trim() || questions.some((q) => q.text.trim())) && (
        <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t(c.preview, lang)}</p>
          {greeting.trim() && <p>{greeting}</p>}
          {questions.filter((q) => q.text.trim()).map((q) => (
            <p key={q.id} className="text-xs">• {q.text}{q.required ? " *" : ""} <span className="text-muted-foreground">({q.type === "yesno" ? tx("Yes/No") : "text"})</span></p>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {t(c.save, lang)}
      </button>
    </section>
  );
}
