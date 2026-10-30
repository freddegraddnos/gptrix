import { useEffect, useRef, useState } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import { Loader2, MapPin } from "lucide-react";

type Pin = { id: string; lat: number; lng: number; name?: string };

/**
 * Studio map: Leaflet (kept) with OpenStreetMap vector tiles from OpenFreeMap
 * rendered through MapLibre. No API key, production use allowed.
 * CARTO raster basemaps were dropped: they now return "API KEY REQUIRED" tiles.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const LOAD_TIMEOUT_MS = 15000;
const ACCENT = "#8A5BF2";

const COPY = {
  en: { loading: "Loading map…", failed: "The map could not be loaded", retry: "Try again", list: "Show studio list" },
  sv: { loading: "Laddar kartan…", failed: "Kartan kunde inte laddas", retry: "Försök igen", list: "Visa studiolista" },
};

/** Calm blue-violet tint on the dark style; labels and roads stay readable. */
function tintStyle(gl: any) {
  const set = (id: string, prop: string, value: unknown) => {
    try { if (gl.getLayer(id)) gl.setPaintProperty(id, prop, value); } catch { /* layer differs */ }
  };
  set("background", "background-color", "#0d0b16");
  set("water", "fill-color", "#151129");
  set("landuse_residential", "fill-color", "#110f1c");
  set("building", "fill-color", "#17142a");
}

export function StudioLeafletMap({
  center,
  studios,
  selected,
  onSelect,
  onShowList,
  lang = "en",
}: {
  center: { lat: number; lng: number };
  studios: Pin[];
  selected: string | null;
  onSelect: (id: string) => void;
  onShowList?: () => void;
  /** Same language as the surrounding page, so error text never switches language on its own. */
  lang?: "en" | "sv";
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const t = COPY[lang];
  // Latest props for draw(): the async map init must not pin a stale studio list.
  const latest = useRef({ center, studios, selected, onSelect });
  latest.current = { center, studios, selected, onSelect };

  useEffect(() => {
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let m: LMap | null = null;
    let glMap: any = null;
    let onGlError: ((e: any) => void) | null = null;
    let onGlIdle: (() => void) | null = null;
    // Each attempt gets its own fresh container, so a half-initialised map
    // can never leave Leaflet's "already initialized" marker behind.
    const host = el.current;
    const box = host ? document.createElement("div") : null;
    if (host && box) {
      box.className = "h-full w-full";
      host.appendChild(box);
    }
    const teardown = () => {
      clearTimeout(timer);
      try { if (glMap && onGlError) glMap.off("error", onGlError); } catch { /* already gone */ }
      try { if (glMap && onGlIdle) glMap.off("idle", onGlIdle); } catch { /* already gone */ }
      try { m?.off(); m?.remove(); } catch { /* partial init */ }
      m = null;
      glMap = null;
      if (map.current) map.current = null;
      layer.current = null;
      box?.remove();
    };
    setStatus("loading");
    (async () => {
      try {
        const mod = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        await import("maplibre-gl/dist/maplibre-gl.css");
        const { maplibreGL } = await import("@maplibre/maplibre-gl-leaflet");
        if (dead || !box) return;
        L.current = mod;
        m = mod.map(box, { zoomControl: true, attributionControl: false }).setView([center.lat, center.lng], 12);
        const gl = (maplibreGL as any)({
          style: STYLE_URL,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org" target="_blank" rel="noreferrer">OpenMapTiles</a>',
        }).addTo(m);
        glMap = gl.getMaplibreMap();
        if (!glMap) throw new Error("WebGL map unavailable");
        timer = setTimeout(() => { if (!dead) setStatus((s) => (s === "loading" ? "error" : s)); }, LOAD_TIMEOUT_MS);
        onGlError = (e: any) => { console.warn("[map]", e?.error?.message ?? e); if (!dead && !glMap?.loaded()) setStatus("error"); };
        onGlIdle = () => {
          if (dead) return;
          clearTimeout(timer);
          tintStyle(glMap);
          draw();
          setStatus("ready");
        };
        glMap.on("error", onGlError);
        glMap.once("idle", onGlIdle);
        map.current = m;
        layer.current = mod.layerGroup().addTo(m);
        draw();
      } catch (err) {
        // WebGL can fail for environment reasons (driver, privacy mode,
        // headless browser); clean up fully so "Try again" starts fresh.
        console.warn("[map] init failed", err);
        teardown();
        if (!dead) setStatus("error");
      }
    })();
    return () => {
      dead = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const draw = () => {
    const mod = L.current;
    const m = map.current;
    const g = layer.current;
    if (!mod || !m || !g) return;
    const { center, studios, selected, onSelect } = latest.current;
    g.clearLayers();
    mod.circleMarker([center.lat, center.lng], { radius: 6, color: "#ffffff", weight: 2, fillColor: "#0d0b16", fillOpacity: 1 }).addTo(g);
    studios
      .filter((s) => s.lat !== 0 || s.lng !== 0)
      .forEach((s) => {
        const on = selected === s.id;
        const mk = mod
          .circleMarker([s.lat, s.lng], {
            radius: on ? 12 : 8,
            color: on ? "#ffffff" : "#0d0b16",
            weight: on ? 3 : 2,
            fillColor: ACCENT,
            fillOpacity: 1,
          })
          .addTo(g);
        if (s.name) mk.bindTooltip(s.name);
        mk.on("click", () => onSelect(s.id));
      });
  };

  useEffect(() => {
    map.current?.setView([center.lat, center.lng], map.current.getZoom());
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, studios, selected]);

  return (
    <div className="relative h-full w-full" style={{ background: "#0d0b16" }}>
      {/* Pins stay hidden until the map background has loaded. */}
      <div ref={el} className={`h-full w-full ${status === "ready" ? "" : "invisible"}`} aria-hidden={status !== "ready"} />
      {status === "ready" && (
        <p className="pointer-events-auto absolute bottom-0 right-0 z-[500] rounded-tl-md bg-[#0d0b16]/85 px-1.5 py-0.5 font-mono text-[10px] leading-snug text-[#b9b3c7]">
          ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-[#e9e4ff] underline-offset-2 hover:underline">OpenStreetMap</a>
          {" · "}
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="text-[#e9e4ff] underline-offset-2 hover:underline">OpenFreeMap</a>
          {" · "}
          <a href="https://openmaptiles.org" target="_blank" rel="noreferrer" className="text-[#e9e4ff] underline-offset-2 hover:underline">OpenMapTiles</a>
        </p>
      )}
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center" role="status">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-accent motion-reduce:animate-none" aria-hidden="true" />
            {t.loading}
          </span>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center" role="alert">
          <div>
            <MapPin className="mx-auto size-6 text-accent" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">{t.failed}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setAttempt((a) => a + 1)} className="btn-primary min-h-11 text-[0.9375rem]">
                {t.retry}
              </button>
              {onShowList && (
                <button type="button" onClick={onShowList} className="btn-secondary min-h-11 text-[0.9375rem]">
                  {t.list}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
