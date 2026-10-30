import { useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useStudioGallery, useStudioTeam } from "@/hooks/useStudio";
import { uploadStudioImage } from "@/lib/studioMedia";
import { WatermarkedImage } from "@/components/InkWatermark";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useStudioLang } from "@/lib/studioLang";

import { tx, useUiLang } from "@/lib/uiLang";
/** Upload and curate photos of finished tattoos, tagged per artist. */
export function StudioGalleryManager({ studioId }: { studioId: string }) {
  useUiLang();
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;
  const { items, urls, loading, add, remove } = useStudioGallery(studioId);
  const { team } = useStudioTeam(studioId);
  const [member, setMember] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  useUnsavedChangesGuard(member !== "" || caption !== "");

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const path = await uploadStudioImage(studioId, file, "gallery");
      await add({ image_url: path, caption: caption.trim() || undefined, member_id: member || null });
      setCaption("");
    } finally {
      setBusy(false);
    }
  };

  const visible = items.filter((i) => filter === "all" || i.member_id === filter);

  return (
    <section className="mt-5 space-y-3">
      <div className="rounded-2xl border border-white/10 bg-slate p-4 space-y-2">
        <p className="text-sm font-bold">{tr("Public work samples", "Offentliga arbetsprover")}</p>
        <p className="text-[11px] text-muted-foreground">{tr("These finished-tattoo photos are shown on the public studio page. They do not need to work as a design image for digital try-on – upload those under Designs.", "Dessa bilder av utförda tatueringar visas på den offentliga studiosidan. De behöver inte fungera som motivbild för digital provning – sådana laddar du upp under Motiv.")}</p>
        <label className="block text-xs text-muted-foreground">{tr("Artist presentation", "Artistpresentation")}
        <select
          value={member}
          onChange={(e) => setMember(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-ink/60 px-3 text-sm text-foreground outline-none focus:border-accent"
        >
          <option value="">{tr("Studio (no specific artist)", "Studion (ingen särskild artist)")}</option>
          {team.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        </label>
        <label className="block text-xs text-muted-foreground">{tr("Public caption (optional)", "Offentlig bildtext (valfritt)")}<input value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-ink/60 px-3 text-sm text-foreground outline-none focus:border-accent" /></label>
        <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-ink text-[11px] font-bold uppercase tracking-widest">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {tr("Choose work sample", "Välj arbetsprov")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          {tr("The watermark marks the image's origin, but cannot prevent copying or reuse.", "Vattenmärket visar bildens ursprung, men kan inte förhindra kopiering eller återanvändning.")}
        </p>
      </div>

      {team.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[{ id: "all", name: tr("All artists", "Alla artister") }, ...team].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold ${
                filter === t.id ? "bg-accent text-ink" : "border border-white/10 bg-slate text-muted-foreground"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {loading && <Loader2 className="mx-auto size-5 animate-spin text-accent" />}
      {!loading && visible.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">{tr("No public work samples yet.", "Inga offentliga arbetsprover ännu.")}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {visible.map((i) => (
          <figure key={i.id} className="relative overflow-hidden rounded-2xl border border-white/5 bg-slate">
            {urls[i.image_url] && (
              <WatermarkedImage
                src={urls[i.image_url] as string}
                alt={i.caption ?? tx("Tattoo by the studio")}
                watermark
                className="aspect-square"
              />
            )}
            <button
              onClick={() => void remove(i.id)}
              aria-label={tx("Remove photo")}
              className="absolute right-2 top-2 size-8 grid place-items-center rounded-full bg-ink/80"
            >
              <Trash2 className="size-3.5" />
            </button>
            {i.caption && (
              <figcaption className="p-2 text-[11px] text-muted-foreground truncate">{i.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
