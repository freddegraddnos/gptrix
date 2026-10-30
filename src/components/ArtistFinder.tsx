import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { openDirectConversation } from "@/hooks/useMessages";
import { TATTOO_STYLES } from "@/lib/tattooStyles";
import { BookingDialog, type BookingStudio } from "@/components/BookingDialog";
import { MULTI_REQUEST_KEY, MAX_MULTI_ARTISTS } from "@/lib/multiRequest";
import {
  Loader2,
  MessageCircle,
  Star,
  Navigation,
  X,
  User as UserIcon,
  Calendar,
  Check,
} from "lucide-react";

import { tx, useUiLang } from "@/lib/uiLang";
type ArtistResult = {
  user_id: string;
  handle: string | null;
  studio_name: string;
  city: string | null;
  address: string | null;
  website: string | null;
  instagram: string | null;
  bio: string | null;
  lat: number | null;
  lng: number | null;
  accepts_messages: boolean;
  styles: string[] | null;
  price_level: number | null;
  rating: number | null;
  avatar_url: string | null;
  verified?: boolean | null;
  distance_km: number | null;
};

export const FINDER_KEY = "inksimulator.studio-finder";
const DISTANCES = [5, 10, 25, 50, 100] as const;

/** Search and filter InkSimulator-connected tattoo artists: name, style, distance, rating. */
export function ArtistFinder({
  q,
  onQChange,
  filtersOpen,
  coords,
  onUseLocation,
  geoBusy,
  radiusKm,
  onRadiusChange,
  onActiveCountChange,
}: {
  q: string;
  onQChange: (value: string) => void;
  filtersOpen: boolean;
  coords: { lat: number; lng: number } | null;
  onUseLocation: () => void;
  geoBusy?: boolean;
  radiusKm: number | null;
  onRadiusChange: (km: number | null) => void;
  onActiveCountChange?: (count: number) => void;
}) {
  useUiLang();
  const { user } = useAuth();
  const [styles, setStyles] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searched, setSearched] = useState(false);
  const scrollTarget = useRef<number | null>(null);
  // Restore the visitor's filters and scroll position when they come back from a studio profile.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(FINDER_KEY) ?? "null") as { styles?: unknown; minRating?: unknown; scrollY?: unknown } | null;
      if (saved) {
        if (Array.isArray(saved.styles)) setStyles(saved.styles.filter((x): x is string => typeof x === "string"));
        if (typeof saved.minRating === "number") setMinRating(saved.minRating);
        if (typeof saved.scrollY === "number") scrollTarget.current = saved.scrollY;
      }
    } catch { /* storage unavailable */ }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      const prev = JSON.parse(sessionStorage.getItem(FINDER_KEY) ?? "{}");
      sessionStorage.setItem(FINDER_KEY, JSON.stringify({ ...prev, styles, minRating }));
    } catch { /* storage unavailable */ }
  }, [styles, minRating, restored]);
  const rememberScroll = () => {
    try {
      const prev = JSON.parse(sessionStorage.getItem(FINDER_KEY) ?? "{}");
      sessionStorage.setItem(FINDER_KEY, JSON.stringify({ ...prev, scrollY: window.scrollY }));
    } catch { /* storage unavailable */ }
  };
  const [results, setResults] = useState<ArtistResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingStudio | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("search_artists_v2", {
      _q: q.trim() || undefined,
      _lat: coords?.lat,
      _lng: coords?.lng,
      _limit: 40,
      _styles: styles.length ? styles : undefined,
      _min_rating: minRating ?? undefined,
    });
    setFailed(Boolean(err));
    setResults(err ? [] : ((data as ArtistResult[] | null) ?? []));
    setLoading(false);
    setSearched(true);
  }, [q, coords, styles, minRating]);

  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => void run(), 250);
    return () => clearTimeout(t);
  }, [run, restored]);

  useEffect(() => {
    if (loading || !searched || scrollTarget.current == null) return;
    const y = scrollTarget.current;
    scrollTarget.current = null;
    requestAnimationFrame(() => window.scrollTo(0, y));
    try {
      const prev = JSON.parse(sessionStorage.getItem(FINDER_KEY) ?? "{}");
      delete prev.scrollY;
      sessionStorage.setItem(FINDER_KEY, JSON.stringify(prev));
    } catch { /* storage unavailable */ }
  }, [loading, searched]);

  const visible = useMemo(() => {
    if (!coords || radiusKm == null) return results;
    return results.filter((a) => a.distance_km == null || a.distance_km <= radiusKm);
  }, [results, coords, radiusKm]);

  useEffect(() => {
    setSelected((prev) =>
      prev.filter((h) => visible.some((a) => (a.handle ?? a.user_id) === h)),
    );
  }, [visible]);

  const toggleStyle = (s: string) =>
    setStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const toggleSelected = (handle: string) =>
    setSelected((prev) => {
      if (prev.includes(handle)) return prev.filter((h) => h !== handle);
      if (prev.length >= MAX_MULTI_ARTISTS) {
        setError(tx("You can send to {n} artists at a time.", { n: MAX_MULTI_ARTISTS }));
        return prev;
      }
      setError(null);
      return [...prev, handle];
    });

  const sendToSelected = () => {
    if (!selected.length) return;
    sessionStorage.setItem(MULTI_REQUEST_KEY, JSON.stringify(selected));
    window.location.href = "/boka/multi";
  };

  const activeFilters = styles.length + (minRating ? 1 : 0) + (coords && radiusKm ? 1 : 0);
  useEffect(() => { onActiveCountChange?.(activeFilters); }, [activeFilters, onActiveCountChange]);
  const clearFilters = () => { setStyles([]); setMinRating(null); onRadiusChange(null); };
  const clearSearch = () => onQChange("");
  const resetAll = () => { clearFilters(); clearSearch(); };
  const chip = (label: string, onRemove: () => void) => (
    <button key={label} onClick={onRemove} aria-label={`Remove filter ${label}`}
      className="inline-flex h-8 items-center gap-1 rounded-full border border-accent bg-accent/10 px-3 text-[11px] font-bold text-accent">
      {label}<X aria-hidden className="size-3" />
    </button>
  );

  const contact = async (artistId: string) => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    setOpening(artistId);
    try {
      const id = await openDirectConversation(user.id, artistId);
      window.location.href = `/messages/${id}`;
    } catch {
      setError(tx("Could not open the conversation."));
      setOpening(null);
    }
  };

  return (
    <section className="mt-1">
      {filtersOpen && (
        <div className="mb-3 rounded-2xl border border-white/10 bg-slate p-3 space-y-4">
          <div>
            <div className="text-mono-caps text-[10px] text-muted-foreground mb-1.5">
              {tx("Style")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TATTOO_STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStyle(s)}
                  aria-pressed={styles.includes(s)}
                  className={`px-2.5 h-8 rounded-full border text-[11px] font-bold transition ${
                    styles.includes(s)
                      ? "border-accent bg-accent text-ink"
                      : "border-white/15 text-foreground/80"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-mono-caps text-[10px] text-muted-foreground mb-1.5">
              {tx("Proximity")}
            </div>
            <button
              onClick={onUseLocation}
              className={`h-9 px-3 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 ${
                coords
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-white/15 text-foreground/80"
              }`}
            >
              {geoBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Navigation className="size-3.5" />
              )}
              {coords ? tx("Sorted by distance") : tx("Use my location")}
            </button>
          </div>

          <div>
            <div className="text-mono-caps text-[10px] text-muted-foreground mb-1.5">
              {tx("Distance")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DISTANCES.map((km) => (
                <button
                  key={km}
                  disabled={!coords}
                  onClick={() => onRadiusChange(radiusKm === km ? null : km)}
                  aria-pressed={radiusKm === km}
                  className={`h-8 px-3 rounded-lg border text-[11px] font-bold disabled:opacity-40 ${
                    radiusKm === km
                      ? "border-accent bg-accent text-ink"
                      : "border-white/15 text-foreground/80"
                  }`}
                >
                  {km} km
                </button>
              ))}
              <button
                disabled={!coords}
                onClick={() => onRadiusChange(null)}
                aria-pressed={radiusKm == null}
                className={`h-8 px-3 rounded-lg border text-[11px] font-bold disabled:opacity-40 ${
                  radiusKm == null
                    ? "border-accent bg-accent text-ink"
                    : "border-white/15 text-foreground/80"
                }`}
              >
                {tx("Any distance")}
              </button>
            </div>
            {!coords && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {tx("Use my location first to filter by distance.")}
              </p>
            )}
          </div>

          <div>
            <div className="text-mono-caps text-[10px] text-muted-foreground mb-1.5">
              {tx("Minimum rating")}
            </div>
            <div className="flex gap-1.5">
              {[3, 4, 4.5].map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRating((cur) => (cur === r ? null : r))}
                  aria-pressed={minRating === r}
                  className={`flex-1 h-8 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-0.5 ${
                    minRating === r
                      ? "border-accent bg-accent text-ink"
                      : "border-white/15 text-foreground/80"
                  }`}
                >
                  <Star className="size-3" />
                  {r}+
                </button>
              ))}
            </div>
          </div>

          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-muted-foreground underline"
            >
              {tx("Clear filters")}
            </button>
          )}
        </div>
      )}

      {!filtersOpen && activeFilters > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label={tx("Active filters")}>
          {styles.map((s) => chip(s, () => toggleStyle(s)))}
          {minRating != null && chip(`${minRating}+ ★`, () => setMinRating(null))}
          {coords && radiusKm != null && chip(`${radiusKm} km`, () => onRadiusChange(null))}
          <button onClick={clearFilters} className="ml-1 text-[11px] text-muted-foreground underline">{tx("Clear filters")}</button>
        </div>
      )}

      {error && (
        <p className="mb-3 text-[11px] text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-foreground">
          {loading
            ? tx("Searching…")
            : tx("Explore studios") + (coords && radiusKm ? tx(" · within {km} km", { km: radiusKm }) : "")}
        </span>
        {!loading && !failed && searched && (
          <span className="text-muted-foreground" aria-live="polite">{visible.length} {visible.length === 1 ? "studio" : "studios"}</span>
        )}
      </div>

      <ul className={visible.length ? "mt-3 space-y-3 pb-16" : "mt-3"}>
        {visible.map((a) => {
          const selectKey = a.handle ?? a.user_id;
          const isSelected = selected.includes(selectKey);
          return (
            <li
              key={a.user_id}
              className={`rounded-2xl border bg-slate/80 px-5 py-5 ${
                isSelected ? "border-accent" : "border-white/10"
              }`}
            >
              <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold truncate">
                      {a.studio_name}
                    </span>
                    {a.rating != null && (
                      <span className="text-[10px] text-accent flex items-center gap-0.5 shrink-0">
                        <Star className="size-3 fill-current" />
                        {Number(a.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {[a.city, a.address].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-4 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-foreground/80 flex items-center gap-1">
                      {a.verified ? (
                        <>
                          <Check className="size-3 text-accent" />
                          {tx("Verified studio")}
                        </>
                      ) : (
                        tx("InkSimulator studio")
                      )}
                    </span>
                    {a.handle && (
                      <Link
                        to="/$handle"
                        params={{ handle: a.handle }}
                        onClick={rememberScroll}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-accent shrink-0"
                      >
                        {tx("Explore studio")}{" "}<span aria-hidden>→</span>
                      </Link>
                    )}
                  </div>

              </div>
            </li>
          );
        })}
      </ul>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4">
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-accent/40 bg-slate/95 p-2 backdrop-blur">
            <button
              onClick={() => setSelected([])}
              className="h-11 px-3 rounded-xl border border-white/15 text-[11px] font-bold text-foreground/80"
            >
              {tx("Clear")}
            </button>
            <button
              onClick={sendToSelected}
              className="flex-1 h-11 rounded-xl bg-accent text-ink font-bold text-[11px] uppercase tracking-widest"
            >
              {tx("Send request to")}{" "}{selected.length} artist{selected.length > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      <BookingDialog studio={booking} onClose={() => setBooking(null)} />

      {!loading && failed && (
        <div role="alert" className="mt-2 rounded-2xl border border-destructive/40 p-4 text-xs">
          <p className="font-bold text-destructive">{tx("Could not load studios — check your connection.")}</p>
          <button onClick={() => void run()} className="mt-3 h-10 rounded-xl border border-white/15 px-4 font-bold">{tx("Try again")}</button>
        </div>
      )}

      {!loading && !failed && searched && visible.length === 0 && (
        <div className="mt-2 rounded-2xl border border-white/10 p-4 text-xs">
          <p className="font-bold">{tx("No studios match")}{q.trim() ? ` “${q.trim()}”` : ""}{activeFilters ? ` with ${activeFilters} filter${activeFilters > 1 ? "s" : ""}` : ""}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters > 0 && <button onClick={clearFilters} className="h-10 rounded-xl border border-accent px-4 font-bold text-accent">{tx("Clear filters")}</button>}
            {q.trim() && <button onClick={clearSearch} className="h-10 rounded-xl border border-white/15 px-4 font-bold">{tx("Clear search")}</button>}
            {activeFilters > 0 && q.trim() && <button onClick={resetAll} className="h-10 rounded-xl border border-white/15 px-4 font-bold">{tx("Reset all")}</button>}
          </div>
          {!activeFilters && !q.trim() && <p className="mt-2 text-muted-foreground">{tx("Try another location.")}</p>}
        </div>
      )}

      <details className="mt-6 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer underline">{tx("What do the studio labels mean?")}</summary>
        <p className="mt-2"><strong className="text-foreground">{tx("InkSimulator studio:")}</strong>{" "}{tx("every studio listed here has been added and approved by InkSimulator.")}</p>
        <p className="mt-1"><strong className="text-foreground">{tx("Verified studio:")}</strong>{" "}{tx("the studio has also confirmed its email and submitted a business document to InkSimulator.")}</p>
      </details>
    </section>
  );
}
