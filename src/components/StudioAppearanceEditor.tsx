import { StudioButton as Button } from "@/components/StudioPrimitives";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { studioImageUrl } from "@/lib/studioMedia";
import { FONTS, resolveSections, themeColors, type StudioPageTheme, type StudioExtraPage, type StudioSectionKey } from "@/lib/studioPageTheme";
import { ThemedStudioPage, type PublicArtist, type ThemeMedia } from "@/components/ArtistPublicProfile";
import { LIVE_SITE_ORIGIN } from "@/lib/studioBookingUrl";
import { ArrowDown, ArrowUp, CheckCircle2, CircleAlert, ExternalLink, Eye, EyeOff, FileText, ImagePlus, LayoutTemplate, Loader2, Monitor, Plus, Smartphone, Trash2 } from "lucide-react";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useStudioGallery, useStudioTeam } from "@/hooks/useStudio";

import { tx, useUiLang } from "@/lib/uiLang";
const box = "studio-card space-y-3";
const input = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm";
const pill = (on: boolean) => `h-10 flex-1 rounded-lg border text-sm ${on ? "bg-primary text-primary-foreground border-primary" : "border-border"}`;
const ACCENTS = ["#8a5bf2", "#7a1f1f", "#d4af37", "#2bb3a3", "#e4572e", "#f6f2ea"];

async function upload(studioId: string, file: File, kind: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${studioId}/theme/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("studio").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw error;
  return path;
}

/** Profile → Appearance: how visitors see inksimulator.com/<handle>. */
export function StudioAppearanceEditor({ studioId, onDirtyChange }: { studioId: string; onDirtyChange?: (dirty: boolean) => void }) {
  useUiLang();
  const navigate = useNavigate();
  const [t, setT] = useState<StudioPageTheme>({});
  const [row, setRow] = useState<{ studio_name: string | null; handle: string | null; bio: string | null; city: string | null; logo_url: string | null; contact_email?: string | null; opening_hours?: string | null; lat?: number | null } | null>(null);
  const [media, setMedia] = useState<ThemeMedia>({});
  const [agent, setAgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [section, setSection] = useState<"content" | "appearance" | "pages" | "preview">("content");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  // The preview shows what is saved; live preview of unsaved edits is not supported yet.
  const [savedT, setSavedT] = useState<StudioPageTheme>({});
  // What visitors see. Drafts never reach the public page until published.
  const [published, setPublished] = useState<StudioPageTheme>({});
  const hasDraft = JSON.stringify(savedT) !== JSON.stringify(published);
  const [serviceCount, setServiceCount] = useState(0);
  const { items: gallery, urls: galleryUrls } = useStudioGallery(studioId);
  const { team } = useStudioTeam(studioId);
  useUnsavedChangesGuard(dirty);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    void (async () => {
      const [{ data }, { data: s }, { count }] = await Promise.all([
        supabase.from("artist_profiles").select("studio_name, handle, bio, city, logo_url, theme, theme_draft, contact_email, opening_hours, lat").eq("user_id", studioId).maybeSingle(),
        supabase.from("studio_agent_settings").select("enabled").eq("studio_id", studioId).maybeSingle(),
        supabase.from("artist_services").select("id", { count: "exact", head: true }).eq("artist_id", studioId),
      ]);
      if (!data) return;
      setRow(data);
      setAgent(!!s?.enabled);
      setServiceCount(count ?? 0);
      const pub = (data.theme as StudioPageTheme) ?? {};
      const draft = (data.theme_draft as StudioPageTheme | null) ?? pub;
      setPublished(pub);
      setT(draft);
      setSavedT(draft);
    })();
  }, [studioId]);

  useEffect(() => {
    void Promise.all([studioImageUrl(row?.logo_url ?? null), studioImageUrl(t.cover ?? null), studioImageUrl(t.bg_image ?? null), studioImageUrl(t.font_file ?? null)])
      .then(([logo, cover, bgImage, fontFile]) => setMedia({ logo, cover, bgImage, fontFile }));
  }, [row?.logo_url, t.cover, t.bg_image, t.font_file]);

  const set = (patch: Partial<StudioPageTheme>) => { setT((x) => ({ ...x, ...patch })); setDirty(true); setStatus(""); };
  const colors = themeColors(t);
  const onFile = async (kind: "cover" | "bg_image" | "font_file" | "logo", file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error(tx("Max 8 MB"));
    setUploading(kind);
    setStatus("Uploading…");
    const localPreview = kind !== "font_file" ? URL.createObjectURL(file) : null;
    const previousMedia = media;
    if (localPreview) setMedia((m) => ({ ...m, [kind === "bg_image" ? "bgImage" : kind]: localPreview }));
    try {
      const path = await upload(studioId, file, kind);
      if (kind === "logo") {
        const { error } = await supabase.from("artist_profiles").update({ logo_url: path }).eq("user_id", studioId);
        if (error) throw error;
        setRow((r) => r && { ...r, logo_url: path });
      } else {
        const next = { ...t, ...(kind === "font_file" ? { font_file: path, font: "custom" } : kind === "bg_image" ? { bg_image: path, bg: "image" } : { cover: path }) } as StudioPageTheme;
        const { error } = await supabase.from("artist_profiles").update({ theme_draft: next as never, theme_draft_updated_at: new Date().toISOString() }).eq("user_id", studioId);
        if (error) throw error;
        setT(next);
        setSavedT(next);
        setDirty(false);
      }
      setStatus(kind === "logo" ? "Logo saved" : kind === "font_file" ? "Font saved in draft" : "Image saved in draft");
    } catch (e) { setMedia(previousMedia); setStatus("Upload failed"); toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(null); if (localPreview) URL.revokeObjectURL(localPreview); }
  };
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("artist_profiles").update({ theme_draft: t as never, theme_draft_updated_at: new Date().toISOString() }).eq("user_id", studioId);
    setBusy(false);
    if (error) { toast.error(error.message); setStatus("Save failed"); } else { toast.success(tx("Draft saved")); setSavedT(t); setDirty(false); setStatus("Draft saved — not public yet"); }
  };
  const publish = async () => {
    setBusy(true);
    const { error } = await supabase.from("artist_profiles").update({ theme: t as never, theme_draft: null, theme_draft_updated_at: null }).eq("user_id", studioId);
    setBusy(false);
    if (error) { toast.error(error.message); setStatus("Publishing failed"); } else { toast.success(tx("Published")); setPublished(t); setSavedT(t); setDirty(false); setStatus("Published"); }
  };
  const discard = async () => {
    if (!window.confirm(tx("Discard the draft and go back to the published version?"))) return;
    setBusy(true);
    const { error } = await supabase.from("artist_profiles").update({ theme_draft: null, theme_draft_updated_at: null }).eq("user_id", studioId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setT(published); setSavedT(published); setDirty(false); setStatus("Draft discarded");
  };

  const previewArtist = useMemo<PublicArtist>(() => ({
    user_id: studioId, handle: row?.handle ?? "studio", studio_name: row?.studio_name ?? "Your studio", city: row?.city ?? null, address: null,
    bio: row?.bio ?? "Custom tattoos, fine line and blackwork.", website: null, instagram: null, avatar_url: null, theme: savedT, agent_enabled: agent,
    styles: [], price_level: null, rating: null, review_count: null, accepts_messages: true, design_count: 0,
    showcase: gallery.map((item) => ({ id: item.id, title: item.caption ?? "Work sample", before_url: null, after_url: galleryUrls[item.image_url] ?? null })),
  }), [row, savedT, agent, studioId, gallery, galleryUrls]);

  const completeness = useMemo(() => {
    if (!row) return [] as [string, string, "appearance" | null][];
    const out: [string, string, "appearance" | null][] = [];
    if (!row.studio_name?.trim()) out.push(["Studio name", "profil", null]);
    if (!row.logo_url) out.push(["Logo", "profil", null]);
    if (!t.cover) out.push(["Cover image", "profil", "appearance"]);
    if (!row.bio?.trim()) out.push(["Studio description", "profil", null]);
    if (!row.city?.trim()) out.push(["City", "profil", null]);
    if (row.lat == null) out.push(["Studio location", "profil", null]);
    if (!row.contact_email?.trim()) out.push(["Contact email", "profil", null]);
    if (!row.opening_hours?.trim()) out.push(["Opening hours", "profil", null]);
    if (gallery.length === 0) out.push(["Work samples", "gallery", null]);
    if (team.filter((a) => a.active).length === 0) out.push(["Artists", "team", null]);
    if (serviceCount === 0) out.push(["Services & prices", "tjanster", null]);
    return out;
  }, [row, t.cover, gallery.length, team, serviceCount]);
  const sectionList = resolveSections(t);
  const SECTION_LABEL: Record<StudioSectionKey, string> = { about: "About the studio", gallery: "Work samples", services: "Services, artists & hours", cta: "Booking" };
  const moveSection = (i: number, dir: -1 | 1) => { const next = [...sectionList]; const j = i + dir; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; set({ sections: next }); };
  const toggleSection = (i: number) => set({ sections: sectionList.map((x, j) => (j === i ? { ...x, hidden: !x.hidden } : x)) });
  const saveNote = <p className="text-xs text-muted-foreground">{tx("Save draft keeps changes private. Visitors see them only after you press Publish. The logo is a profile detail and is saved directly.")}</p>;
  const actions = <div className="space-y-2">
    <div className="grid gap-2 sm:grid-cols-2">
      <Button type="button" variant="outline" disabled={busy || !!uploading || !dirty} onClick={() => void save()} className="h-11 w-full">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{" "}{dirty ? tx("Save draft") : tx("Draft saved")}</Button>
      <Button type="button" disabled={busy || !!uploading || (!dirty && !hasDraft)} onClick={() => void publish()} className="h-11 w-full">{tx("Publish")}</Button>
    </div>
    {hasDraft && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void discard()}>{tx("Discard draft")}</Button>}
  </div>;
  const TEMPLATES: [string, string][] = [
    ["Aftercare", "Aftercare\n\n[Write your own aftercare advice here: the first days, washing, cream, sun and swimming.]"],
    ["Find us", "Find us\n\n[Address, entrance, parking and public transport.]"],
    ["About us", "About us\n\n[Who you are, styles and how you work.]"],
  ];

  const file = (kind: "cover" | "bg_image" | "font_file" | "logo", accept: string, label: string) => (
    <label className="block text-sm">{label}
      <input type="file" accept={accept} disabled={busy} className="mt-1 block w-full text-xs" onChange={(e) => void onFile(kind, e.target.files?.[0])} />
    </label>
  );

  return (
    <section className={box} aria-labelledby="appearance-h">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="appearance-h" className="font-display uppercase text-lg">{tx("Appearance / Utseende")}</h3>
        <div className="flex flex-wrap gap-2">
          {/* Test view stays inside this panel in locked preview mode; it never sends requests or changes the live page. */}
          <Button type="button" variant="outline" size="sm" onClick={() => setSection("preview")}><Eye className="size-4" />{" "}{tx("Review test view")}</Button>
          {row?.handle ? <Button asChild variant="outline" size="sm"><a href={`${LIVE_SITE_ORIGIN}/${encodeURIComponent(row.handle)}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{" "}{tx("Open live page")}</a></Button> : <Button variant="outline" size="sm" disabled title={tx("Available when your studio page is published")}>{tx("Open live page")}</Button>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{tx("This is the one place for your public studio page. Changes are saved as a private draft until you publish them.")}{hasDraft && <span className="ml-1 font-bold text-accent">{tx("Unpublished draft")}</span>}</p>
      <nav className="flex flex-wrap items-center gap-2 border-y border-border py-3" aria-label={tx("Studio page builder")}>
        <span className="text-[11px] font-bold uppercase text-muted-foreground">{tx("Edit")}</span>
        {([
          ["content", "Content", FileText], ["appearance", "Appearance", LayoutTemplate], ["pages", "Subpages", Plus],
        ] as const).map(([key, label, Icon]) => <Button key={key} type="button" variant={section === key ? "secondary" : "ghost"} aria-pressed={section === key} onClick={() => setSection(key)} className="min-h-11"><Icon className="size-4" />{tx(label)}</Button>)}
        <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <Button type="button" variant={section === "preview" ? "secondary" : "outline"} aria-pressed={section === "preview"} onClick={() => setSection("preview")} className="min-h-11"><Eye className="size-4" />{tx("Preview (saved draft)")}</Button>
      </nav>

      {completeness.length > 0 && <div className="rounded-lg border border-accent/50 p-3" role="status">
        <p className="flex items-center gap-2 text-xs font-bold uppercase"><CircleAlert className="size-4 text-accent" />{tx("Next missing task")}</p>
        {(() => { const [label, tab, sec] = completeness[0]; return <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-bold">{tx(label)}</span><Button type="button" size="sm" onClick={() => sec ? setSection(sec) : void navigate({ to: "/artists/dashboard", search: { tab: tab as "profil" } })}>{tx("Add now")} →</Button></div>; })()}
        {completeness.length > 1 && <details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 text-xs text-muted-foreground">{tx("Missing on your studio page")} · {completeness.length}</summary><ul className="mt-1 flex flex-wrap gap-2">{completeness.slice(1).map(([label, tab, sec]) => <li key={label}><Button type="button" size="sm" variant="outline" onClick={() => sec ? setSection(sec) : void navigate({ to: "/artists/dashboard", search: { tab: tab as "profil" } })}>{tx(label)}</Button></li>)}</ul></details>}
      </div>}
      {completeness.length === 0 && row && <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4 text-accent" />{tx("All basic information is filled in.")}</p>}
      {section === "content" && <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{tx("The page uses the information already saved in your studio. Edit each source in its main location—nothing is copied or created twice.")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["Profile details", row?.studio_name ? `${row.studio_name}${row.city ? ` · ${row.city}` : ""}` : "Not completed", "profil"],
            ["Public work samples", `${gallery.length} ${tx("saved")}`, "gallery"],
            ["Artists on the studio page", `${team.filter((artist) => artist.active).length} ${tx("visible")}`, "team"],
            ["Services & prices", `${serviceCount} ${tx("saved")}`, "tjanster"],
          ] as const).map(([label, value, tab]) => <button key={label} type="button" onClick={() => void navigate({ to: "/artists/dashboard", search: { tab } })} className="flex min-h-11 w-full flex-col items-start whitespace-normal rounded-lg border border-border bg-background p-4 text-left text-foreground hover:border-accent focus-visible:outline-2 focus-visible:outline-ring"><span className="block text-sm font-bold">{tx(label)}</span><span className="mt-1 block text-xs text-muted-foreground">{value}{" "}{tx("· Open →")}</span></button>)}
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-bold uppercase text-muted-foreground">{tx("Booking settings")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tx("Booking questions, the deposit rule and message reception have one shared home. Edit them there — not here.")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["Booking questions", "profil", "booking-settings"], ["Deposit rule", "profil", "booking-settings"], ["Message reception", "profil", "booking-settings"], ["Notifications", "notifs", undefined]] as const).map(([label, tab, hash]) => <Button key={label} type="button" size="sm" variant="outline" onClick={() => void navigate({ to: "/artists/dashboard", search: { tab }, hash })}>{tx(label)} →</Button>)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{tx("Booking uses the existing request form. The booking agent remains separate and optional.")}</p>
      </div>}

      {section === "appearance" && <div className="space-y-4">
          <div className="space-y-4 rounded-lg border border-accent/40 p-3">
            <p className="text-xs font-bold uppercase text-accent">{tx("Most important")}</p>
          <div className="flex items-center gap-3">{media.logo ? <img src={media.logo} alt="" className="size-12 rounded-full border border-border object-cover" /> : <span className="grid size-12 place-items-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">{tx("LOGO")}</span>}<div className="min-w-0 flex-1">{file("logo", "image/*", row?.logo_url ? "Replace logo" : "Logo")}</div></div>
          {file("cover", "image/*", "Cover image (top of the page)")}
          {t.cover && <><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{tx("Desktop crop")}<select className={input} value={t.cover_position_desktop ?? "center"} onChange={(e) => set({ cover_position_desktop: e.target.value as "top" | "center" | "bottom" })}><option value="top">{tx("Top")}</option><option value="center">{tx("Center")}</option><option value="bottom">{tx("Bottom")}</option></select></label><label className="text-sm">{tx("Mobile crop")}<select className={input} value={t.cover_position_mobile ?? "center"} onChange={(e) => set({ cover_position_mobile: e.target.value as "top" | "center" | "bottom" })}><option value="top">{tx("Top")}</option><option value="center">{tx("Center")}</option><option value="bottom">{tx("Bottom")}</option></select></label></div><Button type="button" variant="outline" className="text-xs underline" onClick={() => set({ cover: null })}>{tx("Remove cover")}</Button></>}
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">{tx("Accent colour")}</p>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((a) => (
                <Button key={a} type="button" aria-label={`Accent ${a}`} aria-pressed={t.accent === a} onClick={() => set({ accent: a })}
                  className={`studio-swatch size-9 rounded-full border-2 ${t.accent === a ? "border-foreground" : "border-border"}`} style={{ background: a }} />
              ))}
              <input type="color" aria-label={tx("Custom accent")} value={t.accent ?? "#8a5bf2"} onChange={(e) => set({ accent: e.target.value })} className="h-9 w-12 rounded border border-border bg-background" />
            </div>
            {colors.accentAdjusted && <p className="mt-1 text-xs text-muted-foreground">{tx("That colour is hard to read on this background, so a readable shade is used instead.")}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">{tx("Heading font")}</p>
            <select className={input} value={t.font ?? "default"} onChange={(e) => set({ font: e.target.value })} aria-label={tx("Heading font")}>
              {FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            {t.font === "custom" && (
              <div className="mt-2 space-y-1">
                {file("font_file", ".ttf,.otf,.woff,.woff2", "Upload font file")}
                <p className="text-xs text-muted-foreground">{tx("Find fonts on e.g.")}{" "}<a className="underline" href="https://www.dafont.com" target="_blank" rel="noreferrer">dafont.com</a>{tx(". Check that the licence allows commercial use.")}</p>
              </div>
            )}
          </div>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">{tx("Style package")}</p>
            <p className="mb-3 text-xs text-muted-foreground">{tx("A package only changes the order and layout of sections. Texts, images, colours and fonts stay as they are.")}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {([['portfolio', 'Portfolio', 'gallery', 'Work samples first, large images.'], ['studio', 'Studio', 'about', 'Studio presentation first, then work.'], ['personal', 'Personal', 'compact', 'Compact header and image grid.']] as const).map(([pkg, label, layout, desc]) => { const on = (t.package ?? (t.layout === 'gallery' ? 'portfolio' : t.layout === 'compact' ? 'personal' : 'studio')) === pkg; return <button key={pkg} type="button" aria-pressed={on} onClick={() => set({ package: pkg, layout, sections: undefined })} className={`rounded-lg border p-2 text-left ${on ? "border-accent bg-accent/10" : "border-border"}`}>
                <span aria-hidden className="block h-16 rounded bg-secondary p-1.5">{layout === 'gallery' ? <><span className="grid h-8 grid-cols-3 gap-0.5">{[0,1,2].map((k) => <span key={k} className="rounded-sm bg-muted-foreground/40" />)}</span><span className="mx-auto mt-1 block h-1.5 w-2/3 rounded bg-muted-foreground/30" /></> : layout === 'about' ? <><span className="mx-auto block size-5 rounded-full bg-muted-foreground/40" /><span className="mx-auto mt-1 block h-1.5 w-3/4 rounded bg-muted-foreground/30" /><span className="mt-1 grid h-4 grid-cols-2 gap-0.5">{[0,1].map((k) => <span key={k} className="rounded-sm bg-muted-foreground/40" />)}</span></> : <><span className="flex items-center gap-1"><span className="size-4 rounded-full bg-muted-foreground/40" /><span className="h-1.5 w-1/2 rounded bg-muted-foreground/30" /></span><span className="mt-1 grid h-8 grid-cols-4 gap-0.5">{[0,1,2,3].map((k) => <span key={k} className="rounded-sm bg-muted-foreground/40" />)}</span></>}</span>
                <span className="mt-2 block text-sm font-bold">{label}</span><span className="block text-xs text-muted-foreground">{tx(desc)}</span></button>; })}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">{tx("Sections on the page")}</p>
            <p className="mb-2 text-xs text-muted-foreground">{tx("Use the arrows to change order. Booking is always shown.")}</p>
            <ol className="space-y-1">{sectionList.map((x, i) => <li key={x.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm"><span className={`flex-1 ${x.hidden ? "text-muted-foreground line-through" : ""}`}>{i + 1}. {tx(SECTION_LABEL[x.key])}</span><Button type="button" size="icon" variant="ghost" aria-label={`${tx("Move up")}: ${tx(SECTION_LABEL[x.key])}`} disabled={i === 0} onClick={() => moveSection(i, -1)}><ArrowUp className="size-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label={`${tx("Move down")}: ${tx(SECTION_LABEL[x.key])}`} disabled={i === sectionList.length - 1} onClick={() => moveSection(i, 1)}><ArrowDown className="size-4" /></Button>{x.key !== "cta" && <Button type="button" size="icon" variant="ghost" aria-pressed={!x.hidden} aria-label={`${x.hidden ? tx("Show") : tx("Hide")}: ${tx(SECTION_LABEL[x.key])}`} onClick={() => toggleSection(i)}>{x.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>}</li>)}</ol>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">{tx("Background")}</p>
            <div className="flex flex-wrap gap-2">
              {([["dark", "Dark"], ["light", "Light"], ["image", "Image"]] as const).map(([k, l]) => (
                <Button key={k} type="button" aria-pressed={(t.bg ?? "dark") === k} onClick={() => set({ bg: k })} className={pill((t.bg ?? "dark") === k)}>{l}</Button>
              ))}
            </div>
            {t.bg === "image" && <div className="mt-3 border border-dashed border-border p-4"><div className="flex items-center gap-2 text-sm"><ImagePlus className="size-4 text-accent" />{" "}{tx("Background image")}</div><p className="my-2 text-xs text-muted-foreground">{tx("JPG, PNG or WebP, up to 8 MB. A dark overlay keeps text readable.")}</p>{file("bg_image", "image/*", t.bg_image ? "Replace image" : "Choose an image")}{uploading === "bg_image" && <p role="status" className="mt-2 flex items-center gap-2 text-xs"><Loader2 className="size-4 animate-spin" />{" "}{tx("Uploading and saving image…")}</p>}{t.bg_image && !uploading && <p className="mt-2 text-xs text-muted-foreground">{tx("Image uploaded")}</p>}</div>}
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs uppercase text-muted-foreground">{tx("Your own text")}</p>
            <textarea aria-label={tx("Your own text")} rows={4} value={t.intro ?? ""} onChange={(e) => set({ intro: e.target.value })} placeholder={tx("Welcome! Walk-ins on Saturdays…")} className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
          </div>
          {actions}
          {saveNote}
          <p role="status" className="min-h-5 text-xs text-muted-foreground">{uploading ? tx("Uploading…") : dirty ? tx("Unsaved changes") : status}</p>
      </div>}

      {section === "pages" && <div className="space-y-4">
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs uppercase text-muted-foreground">{tx("Buttons & extra pages")}</p>
            <p className="text-xs text-muted-foreground">{tx("Each button opens its own page — e.g. Opening hours, Fine line, Blackwork. Add text, photos or a link.")}</p>
            {(t.pages ?? []).map((pg, i) => {
              const upd = (patch: Partial<StudioExtraPage>) => set({ pages: (t.pages ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={pg.id} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex flex-wrap gap-2">
                    <input aria-label={tx("Button name")} className={input} value={pg.title} placeholder={tx("Button name, e.g. Opening hours")} onChange={(e) => upd({ title: e.target.value })} />
                    <Button type="button" aria-label={tx("Remove page")} variant="outline" className="shrink-0 px-2 text-muted-foreground" onClick={() => set({ pages: (t.pages ?? []).filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button>
                  </div>
                  <textarea aria-label={tx("Page text")} rows={3} className="w-full rounded-lg border border-border bg-background p-2 text-sm" value={pg.text ?? ""} placeholder={tx("Text on this page (optional)")} onChange={(e) => upd({ text: e.target.value })} />
                  <input aria-label={tx("Link")} className={input} value={pg.url ?? ""} placeholder={tx("Link (optional), https://…")} onChange={(e) => upd({ url: e.target.value })} />
                  <label className="block text-xs">{tx("Add photos (")}{pg.images?.length ?? 0})
                    <input type="file" accept="image/*" multiple className="mt-1 block w-full text-xs" onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []); e.target.value = "";
                      if (!files.length) return;
                      setUploading("page");
                      try { const paths = await Promise.all(files.map((f) => upload(studioId, f, "page"))); upd({ images: [...(pg.images ?? []), ...paths] }); setStatus("Photos added — save to publish"); }
                      catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
                      finally { setUploading(null); }
                    }} />
                  </label>
                  {!!pg.images?.length && <Button type="button" variant="outline" className="text-xs underline" onClick={() => upd({ images: [] })}>{tx("Remove photos")}</Button>}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{tx("Optional templates:")}</span>{TEMPLATES.map(([title, text]) => <Button key={title} type="button" size="sm" variant="outline" onClick={() => set({ pages: [...(t.pages ?? []), { id: crypto.randomUUID(), title: tx(title), text: tx(text).split("\n\n").slice(1).join("\n\n") }] })}><Plus className="size-4" />{tx(title)}</Button>)}</div>
            <Button type="button" variant="outline" className="w-full" onClick={() => set({ pages: [...(t.pages ?? []), { id: crypto.randomUUID(), title: "" }] })}><Plus className="size-4" />{" "}{tx("Add button / page")}</Button>
          </div>
          {actions}
          {saveNote}
          <p role="status" className="min-h-5 text-xs text-muted-foreground">{uploading ? tx("Uploading…") : dirty ? tx("Unsaved changes") : status}</p>
      </div>}

      {section === "preview" && <div>
          <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs uppercase text-muted-foreground">{tx("Customer preview")}</p><p role="status" className={`mt-1 text-xs font-bold ${dirty ? "text-accent" : "text-muted-foreground"}`}>{hasDraft ? tx("Showing the saved draft — not public yet") : tx("Showing the published version")}{dirty ? ` · ${tx("You have unsaved changes. Save the draft to see them here.")}` : ""}</p></div><div className="flex gap-1"><Button type="button" size="sm" variant={device === "desktop" ? "secondary" : "ghost"} onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"}><Monitor className="size-4" />{tx("Desktop")}</Button><Button type="button" size="sm" variant={device === "mobile" ? "secondary" : "ghost"} onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"}><Smartphone className="size-4" />{tx("Mobile")}</Button></div></div>
          <div className={`studio-custom-preview max-h-[720px] overflow-y-auto rounded-2xl border border-border px-4 ${device === "mobile" ? "mx-auto max-w-[390px]" : ""}`}>
            <ThemedStudioPage artist={previewArtist} media={media} preview />
          </div>
      </div>}
    </section>
  );
}
