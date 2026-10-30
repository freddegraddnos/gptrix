import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createScanShare } from "@/lib/scanShare.functions";
import { Check, Loader2, Search, Send, Store } from "lucide-react";

type ArtistRow = { user_id: string; studio_name: string; city: string | null };

/** Lets a client send a 3D scan straight to an InkSimulator studio. */
export function SendScanToStudio({ scanId }: { scanId: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ArtistRow[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    const { data } = await supabase.rpc("search_artists", {
      _q: q.trim() || undefined,
      _limit: 8,
    });
    setResults(((data as ArtistRow[] | null) ?? []).map((a) => ({
      user_id: a.user_id,
      studio_name: a.studio_name,
      city: a.city,
    })));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => void run(), 250);
    return () => clearTimeout(t);
  }, [run]);

  const send = async (artist: ArtistRow) => {
    setBusy(artist.user_id);
    setError(null);
    try {
      await createScanShare({
        data: { scanId, days: 30, artistId: artist.user_id, note: note.trim() || null },
      });
      setSentTo(artist.studio_name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the scan.");
    } finally {
      setBusy(null);
    }
  };

  if (sentTo) {
    return (
      <div className="mt-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 flex items-center gap-2 text-sm">
        <Check className="size-4 text-accent" />
        Scan sent to {sentTo}. It appears in their artist panel.
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-slate p-4">
      <div className="flex items-center gap-2">
        <Store className="size-4 text-accent" />
        <h2 className="text-sm font-bold">Send this scan to a studio</h2>
      </div>
      <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-ink/60 px-3 focus-within:border-accent">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search studio or city"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Message to the studio (optional)"
        className="mt-2 w-full min-h-16 rounded-xl border border-white/10 bg-ink/60 p-3 text-sm outline-none focus:border-accent"
      />
      <ul className="mt-2 space-y-2">
        {results.map((a) => (
          <li key={a.user_id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{a.studio_name}</div>
              <div className="text-[11px] text-muted-foreground">{a.city ?? "—"}</div>
            </div>
            <button
              onClick={() => void send(a)}
              disabled={busy !== null}
              className="h-9 px-3 rounded-lg bg-accent text-ink text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy === a.user_id ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              Send
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">No studios matched your search.</p>
      )}
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </section>
  );
}
