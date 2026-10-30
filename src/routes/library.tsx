import { ExploreTabs } from "@/components/ExploreTabs";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Camera,
  Upload,
  
  Star,
  Layers,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Type,
  Brush,
  X as CloseIcon,
  Camera as CameraIcon,
  Image as ImageIcon,
  ArrowRight,
} from "lucide-react";
import { Bookmark, EyeOff, RotateCcw } from "lucide-react";
import { setPaintPrefill, setPaintReturnTo } from "@/lib/paintHandoff";
import {
  listHiddenMotifs,
  subscribeHiddenMotifs,
  unhideMotif,
  clearHiddenMotifs,
} from "@/lib/hiddenMotifs";

import {
  listMyMotifs,
  subscribeMyMotifs,
  saveMyMotif,
  deleteMyMotif,
  deleteMyMotifs,
  renameMyMotif,
  type MyMotif,
} from "@/lib/myMotifs";
import { fileToDataUrl, keyOutBackground } from "@/lib/motifExtract";
import { seo } from "@/lib/seo";
import { SeoInfo } from "@/components/SeoInfo";
import { TextTattooTool } from "@/components/TextTattooTool";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  STYLES,
  TATTOOS,
  TYPES,
  type TattooStyle,
  type TattooType,
} from "@/lib/tattoos";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useAuth } from "@/hooks/useAuth";
import { MARKETPLACE_LIVE } from "@/lib/commerce";
import { BookmarkStar, BookmarkSignInHint } from "@/components/BookmarkStar";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/library")({
  head: () => seo({ path: "/library", title: tx("Tattoo Designs & Motifs — Browse and Try On | InkSimulator"), description: tx("Browse tattoo designs by style, save your favorites and try a design on your body in live AR or on a photo with InkSimulator."), breadcrumb: "Design library" }),
  validateSearch: (search: Record<string, unknown>): { saved?: boolean } => ({
    saved: search.saved === true || search.saved === "1" || search.saved === "true" ? true : undefined,
  }),
  component: Library,
});

function Library() {
  const lang = useUiLang();
  const sv = lang === "sv";
  const { saved } = Route.useSearch();
  const { ids: bookmarkIds, signedIn } = useBookmarks();
  const [style, setStyle] = useState<TattooStyle | "All">("All");
  const [category, setCategory] = useState<TattooType | "All">("All");
  const [scope, setScope] = useState<"all" | "saved" | "mine">(saved ? "saved" : "all");
  const onlyBookmarked = scope === "saved";
  const [q, setQ] = useState("");
  const [libRestored, setLibRestored] = useState(false);
  // Keep search, selection and style when the visitor comes back from AR or photo try-on.
  useEffect(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem("inksimulator.library-view") ?? "null") as { q?: unknown; style?: unknown; category?: unknown; scope?: unknown } | null;
      if (v) {
        if (typeof v.q === "string") setQ(v.q);
        if (typeof v.style === "string" && (v.style === "All" || (STYLES as readonly string[]).includes(v.style))) setStyle(v.style as TattooStyle | "All");
        if (typeof v.category === "string" && (v.category === "All" || (TYPES as readonly string[]).includes(v.category))) setCategory(v.category as TattooType | "All");
        if (!saved && (v.scope === "all" || v.scope === "saved" || v.scope === "mine")) setScope(v.scope);
      }
    } catch { /* storage unavailable */ }
    setLibRestored(true);
  }, [saved]);
  useEffect(() => {
    if (!libRestored) return;
    try { sessionStorage.setItem("inksimulator.library-view", JSON.stringify({ q, style, category, scope })); } catch { /* storage unavailable */ }
  }, [q, style, category, scope, libRestored]);
  const [myMotifs, setMyMotifs] = useState<MyMotif[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<CatalogItem | null>(null);

  useEffect(() => {
    setMyMotifs(listMyMotifs());
    return subscribeMyMotifs(() => setMyMotifs(listMyMotifs()));
  }, []);

  useEffect(() => {
    setHiddenIds(listHiddenMotifs());
    return subscribeHiddenMotifs(() => setHiddenIds(listHiddenMotifs()));
  }, []);

  // One catalog: curated designs + published artist designs.
  const { user } = useAuth();
  const {
    motifs: marketMotifs,
    loading: catalogLoading,
    error: catalogError,
    refresh: refreshCatalog,
  } = useMarketplace(user?.id);

  const catalog = useMemo<CatalogItem[]>(() => {
    const curated: CatalogItem[] = TATTOOS.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artist,
      style: t.style,
      type: t.type,
      src: t.src,
      searchable: [t.name, t.artist, t.type, t.code, t.style].join(" "),
      bookmarkable: true,
      origin: "library",
      purchased: false,
    }));
    const community: CatalogItem[] = marketMotifs
      .filter((m) => !!m.image_url)
      .map((m) => {
        const tagStyle = m.tags.find((tag) =>
          (STYLES as readonly string[]).includes(tag),
        ) as TattooStyle | undefined;
        return {
          id: m.id,
          name: m.name,
          artist: m.artist_name ?? "Artist",
          style: ((m.style && (STYLES as readonly string[]).includes(m.style)
            ? m.style
            : tagStyle) as TattooStyle | undefined),
          type: ((m.category && (TYPES as readonly string[]).includes(m.category)
            ? m.category
            : undefined) as TattooType | undefined),
          src: m.image_url as string,
          searchable: [m.name, m.artist_name ?? "", m.style ?? "", m.category ?? "", ...m.tags].join(" "),
          bookmarkable: false,
          origin: "studio",
          purchased: Boolean(m.purchased),
        };
      });
    const featured = ["jp-sakura-branch-672", "jp-koi-669", "tattoo-moth", "jp-dragon-671"];
    curated.sort((a, b) => {
      const ai = featured.indexOf(a.id);
      const bi = featured.indexOf(b.id);
      return (ai < 0 ? featured.length : ai) - (bi < 0 ? featured.length : bi);
    });
    return [...curated, ...community];
  }, [marketMotifs]);

  const availableStyles = useMemo(() => STYLES.filter((s) => catalog.some((item) => item.style === s)), [catalog]);

  const scrollRestored = useRef(false);
  useEffect(() => {
    if (!libRestored || catalogLoading || scrollRestored.current) return;
    scrollRestored.current = true;
    try {
      const previous = JSON.parse(sessionStorage.getItem("inksimulator.library-scroll") ?? "null");
      if (typeof previous === "number" && Number.isFinite(previous)) requestAnimationFrame(() => window.scrollTo(0, previous));
    } catch { /* storage unavailable */ }
  }, [libRestored, catalogLoading]);
  useEffect(() => {
    const rememberScroll = () => {
      if (!scrollRestored.current) return;
      try { sessionStorage.setItem("inksimulator.library-scroll", JSON.stringify(window.scrollY)); } catch { /* storage unavailable */ }
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, []);

  const items = useMemo(
    () =>
      catalog
        .filter((t) => !hiddenIds.includes(t.id))
        .filter((t) => (style === "All" ? true : t.style === style))
        .filter((t) => (category === "All" ? true : t.type === category))
        .filter(
          (t) =>
            !q.trim() ||
            t.searchable.toLowerCase().includes(q.trim().toLowerCase()),
        ),
    [catalog, style, category, q, hiddenIds],
  );

  const bookmarked = useMemo(
    () =>
      bookmarkIds
        .map((id) => catalog.find((t) => t.id === id))
        .filter((t): t is CatalogItem => !!t)
        .filter((t) => !hiddenIds.includes(t.id))
        .filter((t) => (style === "All" ? true : t.style === style))
        .filter((t) => (category === "All" ? true : t.type === category))
        .filter((t) => !q.trim() || t.searchable.toLowerCase().includes(q.trim().toLowerCase())),
    [bookmarkIds, catalog, hiddenIds, style, category, q],
  );

  const hiddenItems = useMemo(
    () => catalog.filter((t) => hiddenIds.includes(t.id)),
    [catalog, hiddenIds],
  );


  const myDesignsRef = useRef<HTMLDivElement>(null);

  // Trying a design in AR is always free — no teaser, no locked cards.
  const visible = onlyBookmarked ? bookmarked : items;
  const hasSearch = q.trim().length > 0;
  const hasStyle = style !== "All" || category !== "All";
  const clearStyle = () => { setStyle("All"); setCategory("All"); };
  const scopeLabel = scope === "saved" ? (sv ? "sparade motiv" : "saved designs") : scope === "mine" ? (sv ? "mina motiv" : "my designs") : (sv ? "alla motiv" : "all designs");
  const tabLabels = { all: sv ? "Alla motiv" : "All designs", saved: sv ? "Sparade" : "Saved", mine: sv ? "Mina motiv" : "My designs" } as const;
  const countText = (n: number) => sv ? `${n} motiv i ${scopeLabel}` : `${n} ${n === 1 ? "design" : "designs"} in ${scopeLabel}`;
  const resetBtn = "mt-3 inline-flex h-11 items-center rounded-xl border border-accent/60 px-5 text-xs font-bold text-accent";


  return (
    <AppShell referenceSurface>
      <header className="mb-5">
        <div className="text-mono-caps text-[10px] text-accent">{tx("Discover")}</div>
        <h1
          className="mt-1 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight"
          style={{ textShadow: "none" }}
        >
          {tx("Find your next ink")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tx("Find a design that feels like you.")}
        </p>
      </header>
      <ExploreTabs active="designs" />




      <div role="tablist" aria-label={tx("Which designs")} className="mb-3 grid grid-cols-3 rounded-xl border border-white/15 bg-slate p-1">
        {([["all", "All designs", null], ["saved", "Saved", bookmarkIds.length], ["mine", "My designs", myMotifs.length]] as const).map(([key, , count]) => (
          <button key={key} role="tab" aria-selected={scope === key} onClick={() => setScope(key)}
            className={`flex min-h-10 items-center justify-center gap-1 rounded-lg text-xs ${scope === key ? "bg-accent text-ink" : "text-muted-foreground"}`}>
            {key === "saved" && <Bookmark className="size-3.5" fill={scope === "saved" ? tx("currentColor") : "none"} />}
            {key === "mine" && <Layers className="size-3.5" />}
            {tabLabels[key]}{count ? ` (${count})` : ""}
          </button>
        ))}
      </div>

      {scope !== "mine" && (<>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={scope === "saved" ? tx("Search saved designs…") : tx("Search all designs…")}
          aria-label={scope === "saved" ? tx("Search saved designs") : tx("Search all designs")}
          className="w-full h-[52px] pl-10 pr-10 rounded-xl bg-slate/80 border border-accent/20 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent"
        />
        {hasSearch && <button onClick={() => setQ("")} aria-label={tx("Clear search")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="size-4" /></button>}
      </div>

      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{tx("Style")}</div>
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
        {(["All", ...availableStyles] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStyle(s)}
            aria-pressed={style === s}
            className={`px-4 min-h-11 rounded-full text-xs font-normal whitespace-nowrap transition ${
              style === s
                ? "bg-accent/100 text-ink border border-transparent"
                : "bg-transparent border border-white/15 text-foreground/85"
            }`}
          >
            {s === "All" ? (sv ? "Alla" : "All") : s}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <p className="min-w-0 text-muted-foreground" aria-live="polite">
          {catalogLoading && visible.length === 0 ? tx("Loading…") : `${countText(visible.length)}${style !== "All" ? ` · ${style}` : ""}${hasSearch ? ` · “${q.trim()}”` : ""}`}
        </p>
        <Link to="/create" className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-accent">
          {tx("Create a design")}{" "}<span aria-hidden>↗</span>
        </Link>
      </div>
      </>)}

      {scope === "all" && visible.length > 0 && (
        <div className="mb-3">
          <h2 className="text-xs font-normal text-muted-foreground">
            {tx("Selected for inspiration")}
          </h2>
        </div>
      )}

      {scope === "mine" ? null : catalogLoading && visible.length === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/5 bg-slate overflow-hidden animate-pulse"
            >
              <div className="aspect-square bg-artwork/40" />
              <div className="p-3 space-y-2">
                <div className="h-2 w-10 rounded bg-white/10" />
                <div className="h-3 w-3/4 rounded bg-white/10" />
                <div className="h-2 w-1/2 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : onlyBookmarked && bookmarkIds.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate/60 p-6 text-center">
          <Star className="mx-auto size-5 text-amber-300" />
          <p className="mt-2 text-sm font-semibold">{tx("You haven’t saved any designs yet")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("Tap the star on a design to save it here.")}
          </p>
          <button onClick={() => setScope("all")} className={resetBtn}>{tx("Browse all designs")}</button>
        </div>
      ) : visible.length === 0 && !catalogError && !catalogLoading ? (
        <div className="rounded-2xl border border-white/10 bg-slate/60 p-6 text-center">
          <p className="text-sm font-semibold">{hasSearch ? tx("No designs match your search") : tx("No designs match your choices")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tx("In")}{" "}{scopeLabel}{hasStyle ? ` · ${style}` : ""}{hasSearch ? ` · “${q.trim()}”` : ""}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {hasSearch && <button onClick={() => setQ("")} className={resetBtn}>{tx("Clear search")}</button>}
            {hasStyle && <button onClick={clearStyle} className={resetBtn}>{tx("Show all styles")}</button>}
            {onlyBookmarked && <button onClick={() => setScope("all")} className={resetBtn}>{tx("Search all designs")}</button>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((t) => (
            <TattooCard key={t.id} t={t} onOpen={() => setDetail(t)} />
          ))}
        </div>
      )}

      <div ref={myDesignsRef} className={scope === "mine" ? "scroll-mt-24" : "mt-8 scroll-mt-24"}>
        <MyDesigns motifs={myMotifs} />
      </div>

      {hiddenItems.length > 0 && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-slate/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <EyeOff className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold truncate">
                {hiddenItems.length}{" "}{tx("hidden design")}
                {hiddenItems.length === 1 ? "" : "s"}
              </span>
            </div>
            <button
              onClick={() => clearHiddenMotifs()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-white/15 text-xs font-bold"
            >
              <RotateCcw className="size-3.5" />
              {tx("Restore all")}
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {hiddenItems.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => unhideMotif(t.id)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/[0.06] border border-white/10 text-[11px]"
                  aria-label={`Restore ${t.name}`}
                >
                  <span className="truncate max-w-[130px]">{t.name}</span>
                  <RotateCcw className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}


      {catalogError && !onlyBookmarked && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm font-semibold">{tx("Could not load designs")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("Check your connection and try again.")}
          </p>
          <button
            onClick={() => void refreshCatalog()}
            className="mt-3 inline-flex h-11 items-center rounded-xl border border-accent/60 px-5 text-xs font-bold uppercase tracking-widest text-accent"
          >
            {tx("Try again")}
          </button>
        </div>
      )}

      {onlyBookmarked && !signedIn && <BookmarkSignInHint />}


      {!MARKETPLACE_LIVE && scope !== "mine" && visible.length > 0 && (
        <section className="mt-6 rounded-2xl border border-white/12 bg-slate/60 p-5">
          <div className="text-mono-caps text-[10px] text-accent">{tx("Pilot")}</div>
          <h2 className="mt-1 font-display font-bold text-lg">
            {tx("Selling designs is in pilot")}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {tx("Nothing here costs money today — every design is free to try in AR. When paid designs open, a purchase will give you a print-ready stencil PDF at your calibrated size plus the high-resolution file. It is a non-exclusive licence: any tattoo artist you choose may tattoo it on you, and the design stays available to other buyers.")}
          </p>
          <Link
            to="/artists"
            className="mt-4 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
          >
            {tx("I'm an artist — sign up")}
          </Link>
        </section>
      )}
      {detail && <MotifDetailDialog detail={detail} onClose={() => setDetail(null)} />}
      {!sv && (
        <SeoInfo
          title="Tattoo designs and motifs"
          intro="Browse tattoo designs by style and type — from fine line and minimalist motifs to bold traditional pieces — and try any design on your body in live AR or on a photo."
          sections={[
            { h: "Find a motif by style", p: "Filter the library by style, save favourites and compare several tattoo ideas side by side on your own skin." },
            { h: "Bring it to a studio", p: "Save your preview and send it to an approved tattoo studio when you request a booking." },
          ]}
          links={[
            { to: "/ar", label: "Try a tattoo in AR" },
            { to: "/generator", label: "AI tattoo generator" },
            { to: "/guides/placement-guide", label: "Placement guide" },
            { to: "/studios", label: "Tattoo studios" },
          ]}
        />
      )}
    </AppShell>
  );
}

type CatalogItem = {
  id: string;
  name: string;
  artist: string;
  style?: TattooStyle;
  type?: TattooType;
  src: string;
  searchable: string;
  bookmarkable: boolean;
  purchased: boolean;
  origin: "library" | "studio";
};

function TattooCard({ t, onOpen }: { t: CatalogItem; onOpen: () => void }) {
  const sv = useUiLang() === "sv";
  const { isBookmarked, toggle, signedIn } = useBookmarks();
  return (
    <article className="relative flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-paper p-4">
        {t.bookmarkable && (
          <BookmarkStar
            variant="bookmark"
            active={isBookmarked(t.id)}
            onToggle={() => toggle(t.id)}
            label={t.name}
            signedIn={signedIn}
          />
        )}
        <img
          src={t.src}
          alt={t.name}
          loading="lazy"
          className="w-full h-full object-contain"
        />
      </div>

      <div className="pt-3 flex-1 flex flex-col">
        <div className="text-mono-caps text-[10px] text-muted-foreground">
          {t.style ?? tx("Community")} · {t.origin === "studio" ? (sv ? "Studiomotiv" : "Studio design") : (sv ? "Biblioteksmotiv" : "Library design")}
        </div>
        <div className="mt-1 text-sm truncate">{t.name}</div>
        <button
          type="button"
          onClick={onOpen}
          className="mt-1 flex items-center justify-between min-h-11 text-xs text-accent"
        >
          {tx("View design")}{" "}<span aria-hidden className="text-base leading-none">→</span>
        </button>
      </div>
    </article>
  );
}

/**
 * Opens the drawing studio with this design as an ordinary, editable layer —
 * the canvas takes the image's own size. Not a locked reference: the artist
 * is meant to keep working on the design itself.
 */
function EditInStudioButton({
  src,
  name,
  compact = false,
}: {
  src: string;
  name: string;
  compact?: boolean;
}) {
  useUiLang();
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        setPaintPrefill({ url: src, name, mode: "layer" });
        setPaintReturnTo("/library");
        void navigate({ to: "/rita" });
      }}
      className={
        compact
          ? "mt-1 flex h-7 w-full items-center justify-center gap-1 rounded-lg border border-white/15 text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
          : "size-11 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground"
      }
      aria-label={`Edit ${name} in the drawing studio`}
      title={tx("Edit in the drawing studio")}
    >
      <Brush className="size-3.5" />
      {compact && tx("Edit")}
    </button>
  );
}




/** Manage your own designs: add via upload, rename, and delete. */
function MyDesigns({ motifs }: { motifs: MyMotif[] }) {
  useUiLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [textOpen, setTextOpen] = useState(false);
  // Single upload: confirm the transparency result before it becomes a design.
  const [preview, setPreview] = useState<{
    name: string;
    raw: string;
    keyed: string;
  } | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    if (files.length === 1) {
      const file = files[0];
      try {
        const raw = await fileToDataUrl(file);
        const keyed = await keyOutBackground(raw);
        setShowRaw(false);
        setPreview({
          name: file.name.replace(/\.[a-z0-9]+$/i, ""),
          raw,
          keyed,
        });
      } catch {
        toast.error(tx("Could not read the image"));
      }
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    let added = 0;
    for (const file of Array.from(files).slice(0, 12)) {
      try {
        const raw = await fileToDataUrl(file);
        const src = await keyOutBackground(raw);
        saveMyMotif({
          name: file.name.replace(/\.[a-z0-9]+$/i, ""),
          src,
          source: "upload",
        });
        added++;
      } catch {
        /* skip broken file */
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    toast[added ? "success" : "error"](
      added ? `Added ${added} design${added > 1 ? "s" : ""}` : "Could not read the image",
    );
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">
          {tx("My Designs")}{motifs.length > 0 ? ` (${motifs.length})` : ""}
        </h2>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <button
              onClick={() => {
                deleteMyMotifs(selected);
                setSelected([]);
                toast.success(tx("Designs removed"));
              }}
              className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/40 px-3 py-1.5 text-[11px] font-bold text-red-300"
            >
              <Trash2 className="size-3" />{" "}{tx("Delete")}{" "}{selected.length}
            </button>
          )}
          <button
            onClick={() => setTextOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-accent/40 px-3 py-1.5 text-[11px] font-bold text-accent"
          >
            <Type className="size-3" />{" "}{tx("Text")}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold text-ink disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Plus className="size-3" />
            )}
            {tx("Add")}
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />

      {preview && (
        <div className="fixed inset-0 z-50 bg-ink/90 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink p-5">
            <p className="text-[11px] uppercase tracking-widest text-accent font-bold">
              {tx("Background removed")}
            </p>
            <h3 className="mt-1 font-display text-lg">{preview.name}</h3>
            <div className="mt-3 rounded-2xl border border-white/10 bg-checker p-3">
              <img
                src={showRaw ? preview.raw : preview.keyed}
                alt={showRaw ? tx("Original upload") : tx("With the paper removed")}
                className="mx-auto max-h-56 object-contain"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowRaw(true)}
                className={`min-h-11 rounded-xl border text-xs font-bold ${
                  showRaw
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-white/10 text-muted-foreground"
                }`}
              >
                {tx("Before")}
              </button>
              <button
                onClick={() => setShowRaw(false)}
                className={`min-h-11 rounded-xl border text-xs font-bold ${
                  showRaw
                    ? "border-white/10 text-muted-foreground"
                    : "border-accent bg-accent/15 text-accent"
                }`}
              >
                {tx("After")}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {tx("The transparent version is what goes on your skin in AR.")}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 min-h-11 rounded-xl border border-white/10 text-sm font-bold"
              >
                {tx("Cancel")}
              </button>
              <button
                onClick={() => {
                  saveMyMotif({
                    name: preview.name,
                    src: preview.keyed,
                    source: "upload",
                  });
                  setPreview(null);
                  toast.success(tx("Added to My Designs"));
                }}
                className="flex-1 min-h-11 rounded-xl bg-accent text-ink text-sm font-bold"
              >
                {tx("Save design")}
              </button>
            </div>
          </div>
        </div>
      )}

      {textOpen && (
        <TextTattooTool
          onCancel={() => setTextOpen(false)}
          onDone={(url, label) => {
            saveMyMotif({ name: label || "Text", src: url, source: "text" });
            setTextOpen(false);
            toast.success(tx("Text saved to My Designs"));
          }}
        />
      )}

      {motifs.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border border-dashed border-white/15 bg-slate/40 p-6 text-center active:scale-[0.99] transition"
        >
          <Upload className="mx-auto size-5 text-accent" />
          <p className="mt-2 text-sm font-semibold">{tx("Add your own designs")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("Upload drawings or photos — a white paper background is made transparent automatically.")}
          </p>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {motifs.map((m) => {
            const isSel = selected.includes(m.id);
            return (
              <div
                key={m.id}
                className={`relative rounded-xl border p-2 ${
                  isSel ? "border-accent bg-artwork" : "border-white/10 bg-checker"
                }`}
              >
                <button
                  onClick={() => toggleSelect(m.id)}
                  aria-label={isSel ? `Deselect ${m.name}` : `Select ${m.name}`}
                  className={`absolute left-1.5 top-1.5 z-10 size-5 rounded-md grid place-items-center border ${
                    isSel
                      ? "bg-accent text-ink border-accent"
                      : "bg-ink/60 border-white/25 text-transparent"
                  }`}
                >
                  <Check className="size-3" strokeWidth={3} />
                </button>
                <button
                  onClick={() => {
                    deleteMyMotif(m.id);
                    setSelected((s) => s.filter((x) => x !== m.id));
                  }}
                  aria-label={`Delete ${m.name}`}
                  className="absolute right-1.5 top-1.5 z-10 size-5 rounded-md grid place-items-center bg-ink/70 border border-white/20 text-red-300"
                >
                  <Trash2 className="size-3" />
                </button>

                <Link to="/ar" search={{ motif: m.id } as never}>
                  <img
                    src={m.src}
                    alt={m.name}
                    className="aspect-square w-full object-contain"
                  />
                </Link>

                <Link
                  to="/ar"
                  search={{ motif: m.id } as never}
                  className="mt-1 flex h-7 w-full items-center justify-center gap-1 rounded-lg bg-accent text-[9px] font-bold uppercase tracking-widest text-ink"
                >
                  <Camera className="size-3" />{" "}{tx("Try in AR")}
                </Link>

                <EditInStudioButton src={m.src} name={m.name} compact />



                {editing === m.id ? (
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renameMyMotif(m.id, draft);
                          setEditing(null);
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="min-w-0 flex-1 rounded bg-ink/70 border border-white/15 px-1 py-0.5 text-[10px] focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => {
                        renameMyMotif(m.id, draft);
                        setEditing(null);
                      }}
                      aria-label={tx("Save name")}
                      className="text-accent"
                    >
                      <Check className="size-3" />
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      aria-label={tx("Cancel")}
                      className="text-muted-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditing(m.id);
                      setDraft(m.name);
                    }}
                    className="mt-1 flex w-full items-center gap-1 text-left"
                  >
                    <span className="truncate text-[10px] text-muted-foreground">
                      {m.name}
                    </span>
                    <Pencil className="size-2.5 shrink-0 text-muted-foreground" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal motif detail: focus moves in, Tab stays inside, Escape closes, focus returns to the opener. */
function MotifDetailDialog({ detail, onClose }: { detail: CatalogItem; onClose: () => void }) {
  useUiLang();
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!box.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 px-3 pb-3 pt-16 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={detail.name} ref={box}>
      <div className="reference-detail w-full max-w-md rounded-t-[28px] border border-accent/35 p-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-paper p-8">
          <img src={detail.src} alt={detail.name} className="h-full w-full object-contain" />
          <button ref={closeRef} type="button" onClick={onClose} aria-label={tx("Close design")} className="absolute right-3 top-3 grid size-11 place-items-center text-paper-ink">
            <CloseIcon className="size-6" />
          </button>
        </div>
        <div className="px-1 pt-5">
          <div className="text-mono-caps text-[10px] text-accent">{detail.style ?? tx("Community")}</div>
          <h2 className="mt-2 font-display text-[30px] leading-none" style={{ textShadow: "none" }}>{detail.name}</h2>
          <p className="mt-2 text-xs text-muted-foreground">{detail.artist}</p>
          <p className="mt-4 text-xs text-muted-foreground">{tx("See how it feels before you commit.")}</p>
          {detail.origin === "studio" && <Link to="/shop/$id" params={{ id: detail.id }} className="mt-3 inline-flex min-h-11 items-center text-sm text-accent">{tx("View design")}</Link>}
          <Link to="/ar" search={{ motif: detail.id }} className="mt-6 flex min-h-[54px] items-center justify-center gap-3 rounded-xl bg-accent text-sm text-ink">
            <CameraIcon className="size-5" />{" "}{tx("On me with the camera")}{" "}<ArrowRight className="size-5" />
          </Link>
          <Link to="/photo-tryon" search={{ motif: detail.id }} className="mt-3 flex min-h-[54px] items-center justify-center gap-3 rounded-xl border border-white/20 text-sm text-foreground">
            <ImageIcon className="size-5" />{" "}{tx("On a photo")}
          </Link>
          <button type="button" onClick={onClose} className="mt-3 min-h-11 w-full text-xs text-muted-foreground">{tx("Keep exploring")}</button>
        </div>
      </div>
    </div>
  );
}
