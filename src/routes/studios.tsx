import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudioLeafletMap } from "@/components/StudioLeafletMap";
import {
  MapPin,
  Loader2,
  Star,
  Navigation,
  Share2,
  Calendar,
  Plus,
  Minus,
  Search,
  X,
  List as ListIcon,
  Map as MapIcon,
  SlidersHorizontal,
  Crosshair,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useServerFn } from "@tanstack/react-start";
import {
  searchNearbyStudios,
  nearestStudioAnywhere,
  staticStudioMap,
  type NearbyStudio,
} from "@/lib/studios.functions";
import { BookingDialog, type BookingStudio } from "@/components/BookingDialog";
import { ArtistFinder, FINDER_KEY } from "@/components/ArtistFinder";
import { ExploreTabs } from "@/components/ExploreTabs";
import { StudioWaitlist, type NearestStudio } from "@/components/StudioWaitlist";
import { track } from "@/lib/track";
import {
  StudioDetailSheet,
  type StudioSheetTarget,
} from "@/components/StudioDetailSheet";
import { seo } from "@/lib/seo";


import { tx, useUiLang } from "@/lib/uiLang";
import { useAuth } from "@/hooks/useAuth";
import { useIdea } from "@/hooks/useIdea";
import { IdeaBar } from "@/components/IdeaBar";
import { getActiveIdea, isIdeaId, setActiveIdea } from "@/lib/ideaContext";
export const Route = createFileRoute("/studios")({
  validateSearch: (s: Record<string, unknown>): { idea?: string } => (isIdeaId(s.idea) ? { idea: s.idea } : {}),
  head: () => seo({ path: "/studios", title: tx("Find Approved Tattoo Studios — InkSimulator"), description: tx("Search InkSimulator's approved tattoo studios by name or city, filter by style and distance, and send a booking request with your tattoo preview."), breadcrumb: "Studios" }),
  component: StudiosPage,
});

const DEFAULT_CENTER = { lat: 59.3293, lng: 18.0686 }; // Stockholm

/**
 * Fallback map for when Google rejects the browser key for this domain.
 * The picture is rendered on our server through the Static Maps API, so the
 * page still shows the real studios instead of Google's grey error box.
 */
function StaticStudioMap({
  center,
  studios,
}: {
  center: { lat: number; lng: number };
  studios: NearbyStudio[];
}) {
  useUiLang();
  const fetchMap = useServerFn(staticStudioMap);
  const [zoom, setZoom] = useState(12);
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const markerKey = studios.map((s) => `${s.lat},${s.lng}`).join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchMap({
          data: {
            lat: center.lat,
            lng: center.lng,
            zoom,
            markers: studios
              .filter((s) => s.lat !== 0 || s.lng !== 0)
              .slice(0, 20)
              .map((s) => ({ lat: s.lat, lng: s.lng })),
          },
        });
        if (!cancelled) {
          setImage(res.image);
          setFailed(!res.image);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, zoom, markerKey]);

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=tattoo+studio&center=${center.lat},${center.lng}`;

  if (failed) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <MapPin className="mx-auto size-7 text-accent" />
          <p className="mt-3 text-sm font-bold">{tx("Map preview unavailable")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("The studios below are still sorted by distance from you.")}
          </p>
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-10 items-center rounded-xl border border-accent/60 px-4 text-[13px] font-medium text-accent"
          >
            {tx("Open in Google Maps")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <a href={mapsHref} target="_blank" rel="noreferrer" className="block h-full w-full">
        {image ? (
          <img
            src={image}
            alt={tx("Map of {n} tattoo studios", { n: studios.length })}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        )}
      </a>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button
          aria-label={tx("Zoom in")}
          onClick={() => setZoom((z) => Math.min(17, z + 1))}
          className="grid size-9 place-items-center rounded-lg border border-white/15 bg-ink/80 backdrop-blur"
        >
          <Plus className="size-4" />
        </button>
        <button
          aria-label={tx("Zoom out")}
          onClick={() => setZoom((z) => Math.max(5, z - 1))}
          className="grid size-9 place-items-center rounded-lg border border-white/15 bg-ink/80 backdrop-blur"
        >
          <Minus className="size-4" />
        </button>
      </div>
    </div>
  );
}

const MAP_STYLE: Array<Record<string, unknown>> = [
  { elementType: "geometry", stylers: [{ color: "#0f1116" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1116" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8f98" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#22262e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0a0b" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function StudiosPage() {
  useUiLang();
  const routeSearch = Route.useSearch();
  const { user } = useAuth();
  const [ideaId, setIdeaId] = useState<string | null>(null);
  useEffect(() => {
    if (routeSearch.idea) setActiveIdea(routeSearch.idea);
    setIdeaId(routeSearch.idea ?? getActiveIdea());
  }, [routeSearch.idea]);
  const { idea } = useIdea(ideaId, user?.id);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  // Desktop shows the list and map side by side; phones keep the simple toggle.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const showList = wide || view === "list";
  const showMap = wide || view === "map";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);

  const [center, setCenter] = useState(DEFAULT_CENTER);
  // Distances and "nearby" are shown only when the visitor's own position is known.
  const [originKnown, setOriginKnown] = useState(false);
  const [studios, setStudios] = useState<NearbyStudio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bookingStudio, setBookingStudio] = useState<BookingStudio | null>(null);
  const [sheetStudio, setSheetStudio] = useState<StudioSheetTarget | null>(null);
  const [artistCoords, setArtistCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [pageRestored, setPageRestored] = useState(false);
  // Keep search text, list/map view and distance when the visitor returns from a studio profile.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(FINDER_KEY) ?? "null") as { q?: unknown; view?: unknown; radiusKm?: unknown } | null;
      if (saved) {
        if (typeof saved.q === "string") setQ(saved.q);
        if (saved.view === "map" || saved.view === "list") setView(saved.view);
        if (typeof saved.radiusKm === "number") setRadiusKm(saved.radiusKm);
      }
    } catch { /* storage unavailable */ }
    setPageRestored(true);
  }, []);
  useEffect(() => {
    if (!pageRestored) return;
    try {
      const prev = JSON.parse(sessionStorage.getItem(FINDER_KEY) ?? "{}");
      sessionStorage.setItem(FINDER_KEY, JSON.stringify({ ...prev, q, view, radiusKm }));
    } catch { /* storage unavailable */ }
  }, [q, view, radiusKm, pageRestored]);

  const search = useServerFn(searchNearbyStudios);
  const findNearest = useServerFn(nearestStudioAnywhere);
  const [fallback, setFallback] = useState<{ nearest: NearestStudio | null; cities: string[] } | null>(null);

  // studios_viewed — fires once when the /studios page opens.
  useEffect(() => {
    track("studios_viewed");
  }, []);

  const load = useCallback(
    async (lat: number, lng: number) => {
      setLoading(true);
      setError(null);
      try {
        const list = await search({
          data: { lat, lng, radius: Math.round((radiusKm ?? 15) * 1000) },
        });
        setStudios(list);
        // Empty radius: look up the nearest live studio anywhere (list/map untouched).
        if (list.length === 0) {
          findNearest({ data: { lat, lng } }).then(setFallback).catch(() => setFallback(null));
        } else {
          setFallback(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [search, findNearest, radiusKm],
  );

  // The partner map loads only when the visitor opens Map view — the list
  // never assumes Stockholm or any other city as a starting point.
  const mapRequested = useRef(false);
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      void load(center.lat, center.lng);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(next);
        setOriginKnown(true);
        setGeoDenied(false);
        void load(next.lat, next.lng);
      },
      () => {
        setGeoDenied(true);
        void load(center.lat, center.lng);
      },
      { enableHighAccuracy: false, timeout: 6000 },
    );
  }, [center.lat, center.lng, load]);

  useEffect(() => {
    if (!showMap || mapRequested.current) return;
    mapRequested.current = true;
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  // Re-run the nearby search whenever the chosen distance changes (map view).
  const [didMount, setDidMount] = useState(false);
  useEffect(() => {
    if (!didMount) {
      setDidMount(true);
      return;
    }
    if (!showMap) return;
    void load(center.lat, center.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, showMap]);

  // Closest studio first.
  const sortedStudios = useMemo(
    () => [...studios].sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9)),
    [studios],
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setArtistCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoBusy(false);
        setGeoDenied(false);
      },
      () => {
        setGeoBusy(false);
        setGeoDenied(true);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const clearLocation = () => {
    setArtistCoords(null);
    setRadiusKm(null);
    setGeoDenied(false);
  };

  return (
    <AppShell referenceSurface desktopWide>
      {idea && (
        <IdeaBar
          idea={idea}
          onClear={() => {
            setActiveIdea(null);
            setIdeaId(null);
          }}
        />
      )}
      <header className="mb-4">
        <div className="text-mono-caps text-[10px] text-accent">{tx("InkSimulator Studios")}</div>
        <h1 className="mt-1 font-display text-4xl font-bold uppercase leading-[0.95]" style={{ textShadow: "none" }}>
          {tx("Find your studio")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{tx("A place for your next tattoo.")}</p>
      </header>
      <ExploreTabs active="studios" />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tx("Studio name or city")}
          aria-label={tx("Search studios")}
          className="h-[52px] w-full rounded-xl border border-accent/20 bg-slate/80 pl-10 pr-10 text-sm outline-none focus:border-accent/60"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label={tx("Clear search")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={clearLocation}
          className={`inline-flex min-h-11 items-center gap-1.5 text-xs font-bold ${
            artistCoords ? "text-foreground/80" : "text-accent"
          }`}
        >
          <MapPin className="size-4" />
          {tx("All locations")}
        </button>
        <button
          onClick={useMyLocation}
          className={`inline-flex min-h-11 items-center gap-1.5 text-xs font-bold ${
            artistCoords ? "text-accent" : "text-foreground/80"
          }`}
        >
          {geoBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Crosshair className="size-4" />
          )}
          {tx("Near me")}
        </button>
      </div>
      {geoDenied && (
        <p className="mb-3 text-[11px] text-muted-foreground">
          {tx("Location denied — you can still search by name or city.")}
        </p>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-white/15 bg-slate p-1 lg:hidden">
          <button
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={`h-9 px-4 rounded-lg text-[13px] font-medium flex items-center gap-1.5 ${
              view === "list" ? "bg-accent text-ink" : "text-muted-foreground"
            }`}
          >
            <ListIcon className="size-3.5" />
            {tx("List")}
          </button>
          <button
            onClick={() => setView("map")}
            aria-pressed={view === "map"}
            className={`h-9 px-4 rounded-lg text-[13px] font-medium flex items-center gap-1.5 ${
              view === "map" ? "bg-accent text-ink" : "text-muted-foreground"
            }`}
          >
            <MapIcon className="size-3.5" />
            {tx("Map")}
          </button>
        </div>
        {showList && (
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={`h-9 px-3 rounded-xl border text-[13px] font-medium flex items-center gap-1.5 ${
              filtersOpen ? "border-accent/60 text-accent" : "border-white/15 text-foreground/80"
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            {activeCount ? `Filters (${activeCount})` : tx("Filters")}
          </button>
        )}
      </div>

      <div className={wide ? "grid grid-cols-2 items-start gap-6" : ""}>
      {showList && (
      <div className="min-w-0">
        <ArtistFinder
          q={q}
          onQChange={setQ}
          filtersOpen={filtersOpen}
          coords={artistCoords}
          onUseLocation={useMyLocation}
          geoBusy={geoBusy}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          onActiveCountChange={setActiveCount}
        />
      </div>
      )}
      {showMap && (
      <div className={wide ? "sticky top-4 self-start" : ""}>
        <>
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate">
            <div className="h-[280px] lg:h-[560px] w-full relative">
              <StudioLeafletMap
                center={center}
                studios={studios.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name }))}
                selected={selected}
                onSelect={setSelected}
                onShowList={() => (wide ? undefined : setView("list"))}
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {studios.length > 0 && (
            <div className="mt-4 text-mono-caps text-[10px] text-muted-foreground">
              {studios.length}{" "}{tx("InkSimulator")}{" "}{studios.length === 1 ? "studio" : "studios"}
              {originKnown ? " nearby" : ""}
            </div>
          )}

          {!loading && studios.length === 0 && !error && (
            <StudioWaitlist
              nearest={fallback?.nearest}
              cities={fallback?.cities}
              onOpenStudio={(n) =>
                setSheetStudio({ placeId: n.id, name: n.name, address: n.address, lat: 0, lng: 0, source: "partner" })
              }
            />
          )}

          <ul className="mt-2 space-y-2">
            {sortedStudios.map((s) => {
              const isSel = selected === s.id;
              const isPartner = true;
              return (
                <li
                  key={s.id}
                  onClick={() => {
                    setSelected(s.id);
                    // Studios without coordinates must not drag the map to 0,0.
                    if (s.lat !== 0 || s.lng !== 0) setCenter({ lat: s.lat, lng: s.lng });
                  }}
                  className={`rounded-2xl border p-3 cursor-pointer transition ${
                    isSel
                      ? "border-accent bg-accent/5"
                      : "border-white/10 bg-slate hover:border-white/25"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-9 rounded-full grid place-items-center shrink-0 ${
                        isSel ? "bg-accent text-ink" : "bg-white/5 text-accent"
                      }`}
                    >
                      <MapPin className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {s.address}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-block rounded-full bg-accent/15 px-2 py-px text-[9px] font-bold uppercase tracking-widest text-accent">
                          {tx("InkSimulator studio")}
                        </span>
                        {originKnown && s.distanceKm != null && (
                          <span className="inline-block rounded-full bg-white/5 px-2 py-px text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                            {s.distanceKm < 10
                              ? `${s.distanceKm.toFixed(1)} km`
                              : `${Math.round(s.distanceKm)} km`}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[10px]">
                        {s.rating != null && (
                          <span className="flex items-center gap-1 text-accent">
                            <Star className="size-3 fill-current" />
                            {s.rating.toFixed(1)}
                            {s.userRatingCount != null && (
                              <span className="text-muted-foreground">
                                ({s.userRatingCount})
                              </span>
                            )}
                          </span>
                        )}
                        {s.openNow != null && (
                          <span
                            className={
                              s.openNow ? "text-emerald-400" : "text-muted-foreground"
                            }
                          >
                            {s.openNow ? tx("Open now") : tx("Closed")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSel && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSheetStudio({
                            placeId: s.id,
                            name: s.name,
                            address: s.address,
                            lat: s.lat,
                            lng: s.lng,
                            source: s.source,
                          });
                        }}
                        className="col-span-2 h-10 rounded-lg bg-white/[0.06] border border-white/10 font-medium text-[13px]"
                      >
                        {isPartner
                          ? tx("Photos · Prices · Hours · Send tattoo")
                          : tx("Photos · Hours · Address")}
                      </button>
                      {isPartner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookingStudio({
                              name: s.name,
                              address: s.address,
                              placeId: s.id,
                              lat: s.lat,
                              lng: s.lng,
                            });
                          }}
                          className="col-span-2 h-9 rounded-lg bg-accent text-ink font-medium text-[13px] flex items-center justify-center gap-1.5"
                        >
                          <Calendar className="size-3" />
                          {tx("Book")}
                        </button>
                      )}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="h-9 rounded-lg border border-white/10 font-medium text-[13px] flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="size-3" />
                        {tx("Directions")}
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + " " + s.address)}`;
                          const text = `${s.name} — ${s.address}\n${url}`;
                          if (navigator.share)
                            void navigator.share({ title: s.name, text, url });
                          else void navigator.clipboard.writeText(text);
                        }}
                        className="h-9 rounded-lg border border-white/10 font-medium text-[13px] flex items-center justify-center gap-1.5"
                      >
                        <Share2 className="size-3" />
                        {tx("Share")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      </div>
      )}
      </div>

      <StudioDetailSheet
        target={sheetStudio}
        onClose={() => setSheetStudio(null)}
        onBook={(t) => {
          setSheetStudio(null);
          setBookingStudio({
            name: t.name,
            address: t.address,
            placeId: t.placeId,
            lat: t.lat,
            lng: t.lng,
          });
        }}
      />
      <BookingDialog studio={bookingStudio} onClose={() => setBookingStudio(null)} />

    </AppShell>
  );
}
