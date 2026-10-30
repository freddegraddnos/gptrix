import { publicSiteUrl } from "@/lib/publicOrigin";
/**
 * The public design gallery: every design an approved studio has published,
 * free to save or for sale. Paid designs stay watermarked until bought.
 */
import { tx } from "@/lib/uiLang";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Search, ShoppingBag, Plus, Upload, Sparkles, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { useAuth } from "@/hooks/useAuth";
import { useMarketplace, formatKr } from "@/hooks/useMarketplace";
import { TYPES } from "@/lib/tattoos";
import { PLACEMENTS, COVERAGES, matchesPlacementFilter } from "@/lib/motifPlacement";
import { AVAILABILITY_LABELS } from "@/lib/tattooOffer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/shop/")({
  head: () => ({
    meta: [
      { title: "Tattoo design gallery — InkSimulator" },
      {
        name: "description",
        content:
          "Browse tattoo designs from real studios. Try any design on your skin in AR, save the free ones or buy the one you want to wear.",
      },
      { property: "og:title", content: "Tattoo design gallery — InkSimulator" },
      {
        property: "og:description",
        content:
          "Designs from real tattoo studios — free to try in AR, yours to buy and take to your artist.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: publicSiteUrl("/shop") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: publicSiteUrl("/shop") }],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { user } = useAuth();
  const { motifs, loading } = useMarketplace(user?.id);
  const [q, setQ] = useState("");
  const [style, setStyle] = useState<string>("All");
  const [category, setCategory] = useState<string>("All");
  const [placement, setPlacement] = useState<string>("All");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [coverage, setCoverage] = useState<string>("All");

  const styles = useMemo(() => {
    const set = new Set<string>();
    motifs.forEach((m) => m.style && set.add(m.style));
    return ["All", ...Array.from(set).sort()];
  }, [motifs]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return motifs.filter((m) => {
      if (availableOnly && m.tattoo_availability !== "available") return false;
      if (style !== "All" && m.style !== style) return false;
      if (category !== "All" && m.category !== category) return false;
      if (!matchesPlacementFilter(m, placement, coverage)) return false;
      if (!needle) return true;
      return [m.name, m.style ?? "", m.category ?? "", m.artist_name ?? "", ...m.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [motifs, q, style, category, placement, coverage, availableOnly]);

  const hasFilters = availableOnly || Boolean(q.trim()) || style !== "All" || category !== "All" || placement !== "All" || coverage !== "All";
  const resetFilters = () => {
    setQ("");
    setAvailableOnly(false);
    setStyle("All");
    setCategory("All");
    setPlacement("All");
    setCoverage("All");
  };

  return (
    <AppShell>
      <TopBar title="Gallery" />
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-accent" />
          <h1 className="font-display text-2xl font-bold">Design gallery</h1>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {tx("Designs from studios: ask about tattoo work or explore digital files. The artist’s usage terms apply to each design.")}
        </p>
      </header>

      <label className="relative mb-3 block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, studio, style, category or tag…"
          className="h-11 w-full rounded-xl border border-white/10 bg-slate pl-9 pr-3 text-sm"
        />
      </label>

      {styles.length > 1 && (
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by style">
          {styles.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={style === s ? "default" : "outline"}
              onClick={() => setStyle(s)}
              className="shrink-0 rounded-full text-xs"
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by category">
        {["All", ...TYPES].map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={category === value ? "default" : "outline"}
            onClick={() => setCategory(value)}
            className="shrink-0 rounded-full text-xs"
          >
            {value}
          </Button>
        ))}
      </div>

      {[
        { label: "Placement", value: placement, set: setPlacement, opts: PLACEMENTS },
        { label: "Coverage", value: coverage, set: setCoverage, opts: COVERAGES },
      ].map((row) => (
        <div key={row.label} className="no-scrollbar mb-3 flex items-center gap-2 overflow-x-auto pb-1" aria-label={tx(row.label)}>
          <span className="shrink-0 text-mono-caps text-[10px] text-muted-foreground">{tx(row.label)}</span>
          {[{ id: "All", label: "All" }, ...row.opts].map((o) => (
            <Button key={o.id} type="button" size="sm" variant={row.value === o.id ? "default" : "outline"} onClick={() => row.set(o.id)} className="shrink-0 rounded-full text-xs">
              {tx(o.label)}
            </Button>
          ))}
        </div>
      ))}

      {(availableOnly || motifs.some(m => m.tattoo_availability === "available")) && <label className="mb-3 flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} />{tx("Available artist designs only")}
      </label>}
      {!loading && (
        <div className="mb-4 flex min-h-8 items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{visible.length} {visible.length === 1 ? "design" : "designs"}</span>
          {hasFilters && (
            <Button type="button" size="sm" variant="ghost" onClick={resetFilters} className="gap-1.5">
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-accent" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-8 text-center">
          <p className="text-sm font-bold">No designs here yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {motifs.length === 0
              ? "Studios are uploading their first designs. Check back soon."
              : "Try another style or search word."}
          </p>
          <GalleryAlternatives />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {visible.map((m) => (
            <li key={m.id}>
              <Link
                to="/shop/$id"
                params={{ id: m.id }}
                className="block overflow-hidden rounded-2xl border border-white/10 bg-slate"
              >
                <div className="aspect-square bg-artwork">
                  {m.image_url && (
                    <img
                      src={m.image_url}
                      alt={m.name}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <div className="truncate text-sm font-bold">{m.name}</div>
                  {m.tattoo_availability && <p className="text-xs text-accent">{tx(AVAILABILITY_LABELS[m.tattoo_availability])}</p>}
                  <div className="truncate text-[11px] text-muted-foreground">
                    {m.artist_name ?? "Studio"}
                    {m.style ? ` · ${m.style}` : ""}
                  </div>
                  <div
                    className={`text-[11px] font-bold ${
                      m.price_ore > 0 ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {m.price_ore > 0 ? formatKr(m.price_ore) : tx("Free to try digitally")}
                    {m.purchased ? " · Purchased" : ""}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && visible.length > 0 && visible.length <= 4 && <GalleryAlternatives compact />}

      <Link
        to="/shop/new"
        className="mt-5 flex h-12 items-center justify-center gap-2 rounded-xl border border-white/12 text-sm font-bold"
      >
        <Plus className="size-4" /> I'm a studio — list a design
      </Link>
    </AppShell>
  );
}

function GalleryAlternatives({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "mt-5 border-t border-white/10 pt-5" : "mt-5"}>
      <p className="mb-3 text-xs text-muted-foreground">Can't find the right design?</p>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-11 gap-2 text-xs">
          <Link to="/try-it-on"><Upload className="size-4" /> Upload screenshot</Link>
        </Button>
        <Button asChild className="h-11 gap-2 text-xs">
          <Link to="/generator"><Sparkles className="size-4" /> Create with AI</Link>
        </Button>
      </div>
    </div>
  );
}
