import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { searchStudioActions } from "@/lib/studioActions";
import type { NavKey } from "@/lib/studioNav";

const C = {
  sv: { label: "Vad vill du göra?", ph: "T.ex. meddelanden, lediga tider, priser", none: "Ingen träff.", describe: "Beskriv vad du försöker göra", send: "Skicka fråga", thanks: "Tack, vi har tagit emot din fråga.", fail: "Frågan kunde inte skickas.", clear: "Rensa" },
  en: { label: "What do you want to do?", ph: "E.g. messages, free times, prices", none: "No match.", describe: "Describe what you are trying to do", send: "Send question", thanks: "Thanks, we have received your question.", fail: "The question could not be sent.", clear: "Clear" },
};

export function StudioActionSearch({ lang, onOpen, isVisible = () => true }: { lang: "sv" | "en"; onOpen: (key: NavKey) => void; isVisible?: (key: NavKey) => boolean }) {
  const t = C[lang];
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const results = useMemo(() => searchStudioActions(q).filter(item => isVisible(item.nav)).slice(0, 6), [q, isVisible]);
  const searched = q.trim().length >= 2;

  const send = async () => {
    if (!user || !msg?.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("studio_help_requests").insert({ studio_id: user.id, query: q.trim(), message: msg.trim() });
    setBusy(false);
    if (error) { toast.error(t.fail); return; }
    setSent(true);
  };

  return (
    <div className="relative mb-6 max-w-xl">
      <label className="block">
        <span className="field-label">{t.label}</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={q} placeholder={t.ph} className="field-input pl-9 pr-10"
            onChange={e => { setQ(e.target.value); setMsg(null); setSent(false); }} />
          {q && <button type="button" aria-label={t.clear} onClick={() => { setQ(""); setMsg(null); setSent(false); }} className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-muted-foreground"><X className="size-4" /></button>}
        </span>
      </label>
      {searched && <div className="mt-2 rounded-xl border border-border bg-card p-2" aria-live="polite">
        {results.length > 0 ? <ul>
          {results.map(r => <li key={r.key}><button type="button" onClick={() => { setQ(""); onOpen(r.nav); }}
            className="block min-h-11 w-full rounded-lg px-3 py-2 text-left hover:bg-secondary">
            <span className="block text-sm text-foreground">{r.name[lang]}</span>
            <span className="block text-xs text-muted-foreground">{r.desc[lang]}</span>
          </button></li>)}
        </ul> : sent ? <p className="p-3 text-sm">{t.thanks}</p> : msg === null ? <div className="p-2">
          <p className="text-sm text-muted-foreground">{t.none}</p>
          <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => setMsg(q.trim())}>{t.describe}</Button>
        </div> : <div className="space-y-2 p-2">
          <label className="block"><span className="field-label">{t.describe}</span>
            <textarea value={msg} maxLength={2000} rows={3} onChange={e => setMsg(e.target.value)} className="field-input min-h-24 py-2" /></label>
          <Button type="button" disabled={busy || !msg.trim()} onClick={() => void send()} className="btn-primary h-auto">{t.send}</Button>
        </div>}
      </div>}
    </div>
  );
}
