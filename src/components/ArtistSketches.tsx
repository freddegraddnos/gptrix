import { StudioButton as Button } from "@/components/StudioPrimitives";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useStudioLang } from "@/lib/studioLang";

import { tx, useUiLang } from "@/lib/uiLang";
type Sketch = {
  id: string;
  title: string;
  note: string | null;
  image_path: string;
  created_at: string;
};

/** Artist sketch library: upload, preview and delete private sketches. */
export function ArtistSketches({ artistId }: { artistId: string }) {
  useUiLang();
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;
  const [items, setItems] = useState<Sketch[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("artist_sketches")
      .select("id,title,note,image_path,created_at")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Sketch[];
    setItems(list);
    if (list.length) {
      const { data: signed } = await supabase.storage
        .from("sketches")
        .createSignedUrls(
          list.map((s) => s.image_path),
          3600,
        );
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => {
        const item = list[i];
        if (item && s.signedUrl) map[item.id] = s.signedUrl;
      });
      setUrls(map);
    }
    setLoading(false);
  }, [artistId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(tx("Only image files (PNG, JPG) can be uploaded."));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(tx("The file is too large (max 10 MB)."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${artistId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("sketches")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("artist_sketches").insert({
        artist_id: artistId,
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        note: note.trim() || null,
        image_path: path,
      });
      if (dbErr) throw dbErr;
      setTitle("");
      setNote("");
      await load();
    } catch {
      setError(tx("Could not upload the sketch. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: Sketch) => {
    setBusy(true);
    await supabase.storage.from("sketches").remove([s.image_path]);
    await supabase.from("artist_sketches").delete().eq("id", s.id);
    setBusy(false);
    void load();
  };

  return (
    <section className="mt-5 space-y-3">
      <div className="studio-card space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-accent font-bold">
          {tr("New private sketch", "Ny privat skiss")}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
           aria-label={tr("Sketch title", "Skisstitel")}
           placeholder={tr("Title (optional)", "Titel (valfritt)")}
          className="w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm outline-none focus:border-accent"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
           aria-label={tr("Private note", "Privat anteckning")}
           placeholder={tr("Note, e.g. size or client", "Anteckning, t.ex. storlek eller kund")}
          className="w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm outline-none focus:border-accent"
        />
        <label className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
           {tr("Upload private sketch", "Ladda upp privat skiss")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        {error && <p className="text-[11px] text-red-400">{error}</p>}
        <p className="text-[11px] text-muted-foreground">
          {tr("Sketches in this library are private and can be attached to customer messages. Motifs for sale are uploaded separately under Sell designs.", "Skisser i detta bibliotek är privata och kan bifogas i kundmeddelanden. Motiv till försäljning laddas upp separat under Sälj motiv.")}
        </p>
      </div>

      {loading ? (
        <p className="text-center text-xs text-muted-foreground py-6">
          {tx("Loading sketches…")}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {tx("No sketches yet. Upload your first design above.")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-white/5 bg-slate overflow-hidden"
            >
              {urls[s.id] ? (
                <img
                  src={urls[s.id]}
                  alt={s.title}
                  loading="lazy"
                  className="w-full aspect-square object-contain bg-white"
                />
              ) : (
                <div className="w-full aspect-square bg-white/5 animate-pulse" />
              )}
              <div className="p-3">
                <div className="text-sm font-semibold truncate">{s.title}</div>
                {s.note && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {s.note}
                  </div>
                )}
                <Button
                  onClick={() => void remove(s)}
                  disabled={busy}
                  className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"
                >
                  <Trash2 className="size-3" />{" "}{tx("Remove")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
        <Plus className="size-3" />{" "}{tx("Tip: sketches can be attached directly in chat.")}
      </p>
    </section>
  );
}
