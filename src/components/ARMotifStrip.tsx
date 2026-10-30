import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Layers, PenTool, Search, Type, Upload, X } from "lucide-react";
import { STYLES, type Tattoo, type TattooStyle } from "@/lib/tattoos";
import { deleteMyMotif, type MyMotif } from "@/lib/myMotifs";
import { setPaintReturnTo } from "@/lib/paintHandoff";


/**
 * The in-camera design strip. Memoised on purpose: the AR view re-renders at
 * tracking frame rate, and re-rendering these <img> tiles that often made the
 * motifs visibly flicker.
 */
export const ARMotifStrip = memo(function ARMotifStrip({
  stripStyle,
  stripQuery,
  stripSearchOpen,
  myMotifs,
  tattoos,
  customImage,
  customLabel,
  selectedId,
  uploadInputRef,
  onToggleSearch,
  onQueryChange,
  onStyleChange,
  onOpenGallery,
  onOpenText,
  onUploadClick,
  onUpload,
  onDeleteCustom,
  onPickMotif,
  onPickTattoo,
}: {
  stripStyle: TattooStyle | "All";
  stripQuery: string;
  stripSearchOpen: boolean;
  myMotifs: MyMotif[];
  tattoos: Tattoo[];
  customImage: string | null;
  customLabel: string | null;
  selectedId: string;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleSearch: () => void;
  onQueryChange: (v: string) => void;
  onStyleChange: (s: TattooStyle | "All") => void;
  onOpenGallery: () => void;
  onOpenText: () => void;
  onUploadClick: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteCustom: () => void;
  onPickMotif: (m: MyMotif) => void;
  onPickTattoo: (t: Tattoo) => void;
}) {
  const q = stripQuery.trim().toLowerCase();
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const clearPress = useCallback(() => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  }, []);

  const beginPress = useCallback(
    (e: React.PointerEvent, id: string) => {
      clearPress();
      pressStart.current = { x: e.clientX, y: e.clientY };
      suppressClick.current = false;
      pressTimer.current = window.setTimeout(() => {
        suppressClick.current = true;
        setPendingDeleteId(id);
        pressTimer.current = null;
      }, 500);
    },
    [clearPress],
  );

  const movePress = useCallback(
    (e: React.PointerEvent) => {
      const start = pressStart.current;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
        clearPress();
      }
    },
    [clearPress],
  );

  useEffect(() => {
    const dismiss = (e: PointerEvent) => {
      if (!pendingDeleteId) return;
      const target = e.target;
      if (target instanceof Element && target.closest("[data-delete-active]")) return;
      setPendingDeleteId(null);
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      clearPress();
    };
  }, [pendingDeleteId, clearPress]);


  return (
    <div>
      {/* Same category filters as the library, so switching mid-session
          never means leaving the camera. */}
      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={onToggleSearch}
          aria-label="Search designs"
          aria-expanded={stripSearchOpen}
          className={`flex-none h-7 px-2.5 rounded-full text-[11px] font-bold grid place-items-center border ${
            stripSearchOpen || stripQuery
              ? "bg-accent text-ink border-accent"
              : "border-white/15 bg-ink/60 text-muted-foreground"
          }`}
        >
          <Search className="size-3.5" />
        </button>
        {(["All", ...STYLES] as const).map((s) => (
          <button
            key={s}
            onClick={() => onStyleChange(s)}
            className={`flex-none h-7 px-3 rounded-full text-[11px] font-bold uppercase tracking-widest border transition ${
              stripStyle === s
                ? "bg-accent text-ink border-accent"
                : "border-white/15 bg-ink/60 text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {stripSearchOpen && (
        <input
          value={stripQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search design, artist, style…"
          aria-label="Search designs"
          autoFocus
          className="mt-2 h-9 w-full rounded-xl bg-ink/70 border border-white/12 px-3 text-[13px] outline-none focus:border-accent placeholder:text-muted-foreground"
        />
      )}

      <div className="mt-2 flex gap-3 overflow-x-auto pb-0.5 no-scrollbar">
        <Link
          to="/rita"
          onClick={() => setPaintReturnTo()}
          className="flex-none size-14 rounded-xl border-2 border-dashed border-accent/40 text-accent flex flex-col items-center justify-center gap-0.5"
          aria-label="Draw your own design"
          title="Open the sketch tool"
        >
          <PenTool className="size-4" />
          <span className="text-[11px] uppercase font-bold">Draw</span>
        </Link>
        <button
          onClick={onOpenGallery}
          className="flex-none size-14 rounded-xl border-2 border-white/20 bg-ink/60 flex flex-col items-center justify-center gap-0.5 text-foreground/90"
          aria-label="Open the gallery"
          title="Browse all designs"
        >
          <Layers className="size-4" />
          <span className="text-[11px] uppercase font-bold">Gallery</span>
        </button>
        <button
          onClick={onOpenText}
          className="flex-none size-14 rounded-xl border-2 border-dashed border-accent/40 text-accent flex flex-col items-center justify-center gap-0.5"
          aria-label="Create text tattoo"
          title="Choose a font and write your own text"
        >
          <Type className="size-4" />
          <span className="text-[11px] uppercase font-bold">Text</span>
        </button>
        <label
          onClick={onUploadClick}
          className="flex-none size-14 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
        >
          <Upload className="size-4" />
          <span className="text-[11px] uppercase font-bold">Upload</span>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onUpload}
          />
        </label>
        {customImage && (
          <div
            className="relative flex-none size-14"
            data-delete-active={pendingDeleteId === "custom" ? "true" : undefined}
          >
          <button
            onClick={() => {
              if (suppressClick.current) suppressClick.current = false;
            }}
            onPointerDown={(e) => beginPress(e, "custom")}
            onPointerMove={movePress}
            onPointerUp={clearPress}
            onPointerLeave={clearPress}
            onPointerCancel={clearPress}
            onContextMenu={(e) => {
              e.preventDefault();
              suppressClick.current = true;
              setPendingDeleteId("custom");
            }}
            className="size-14 rounded-xl overflow-hidden border-2 border-accent ring-4 ring-accent/10 bg-slate"
            aria-label="Your upload — press and hold for options"
            title="Press and hold to remove"
          >
            <img
              src={customImage}
              alt={customLabel ?? "Your upload"}
              className="w-full h-full object-contain bg-white p-1"
            />
          </button>
          {pendingDeleteId === "custom" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCustom();
                setPendingDeleteId(null);
              }}
              className="absolute right-0 top-0 z-20 grid size-7 place-items-center rounded-full border-2 border-ink bg-destructive text-destructive-foreground shadow-lg"
              aria-label="Remove your upload"
            >
              <X className="size-4" />
            </button>
          )}
          </div>
        )}
        {stripStyle === "All" &&
          myMotifs
            .filter((m) => !q || m.name.toLowerCase().includes(q))
            .filter((m) => m.src !== customImage)
            .map((m) => (
              <div
                key={m.id}
                className="relative flex-none size-14"
                data-delete-active={pendingDeleteId === m.id ? "true" : undefined}
              >
              <button
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  onPickMotif(m);
                }}
                onPointerDown={(e) => beginPress(e, m.id)}
                onPointerMove={movePress}
                onPointerUp={clearPress}
                onPointerLeave={clearPress}
                onPointerCancel={clearPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  suppressClick.current = true;
                  setPendingDeleteId(m.id);
                }}
                className="size-14 rounded-xl overflow-hidden bg-artwork border border-white/10"
                aria-label={`Try ${m.name} — press and hold to remove`}
                title={`${m.name} — press and hold to remove`}
              >
                <img
                  src={m.src}
                  alt={m.name}
                  loading="lazy"
                  className="w-full h-full object-contain bg-white p-1"
                />
              </button>
              {pendingDeleteId === m.id && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMyMotif(m.id);
                    setPendingDeleteId(null);
                  }}
                  className="absolute right-0 top-0 z-20 grid size-7 place-items-center rounded-full border-2 border-ink bg-destructive text-destructive-foreground shadow-lg"
                  aria-label={`Remove ${m.name}`}
                >
                  <X className="size-4" />
                </button>
              )}
              </div>
            ))}

        {tattoos
          .filter((t) => (stripStyle === "All" ? true : t.style === stripStyle))
          .filter(
            (t) =>
              !q ||
              [t.name, t.artist, t.style, t.type].join(" ").toLowerCase().includes(q),
          )
          .map((t) => (
            <button
              key={t.id}
              onClick={() => onPickTattoo(t)}
              className={`flex-none size-14 rounded-xl overflow-hidden bg-artwork ${
                t.id === selectedId && !customImage
                  ? "border-2 border-accent ring-4 ring-accent/10"
                  : "border border-white/10"
              }`}
              aria-label={`Try ${t.name}`}
            >
              <img
                src={t.src}
                alt={t.name}
                loading="lazy"
                className="w-full h-full object-contain bg-white p-1"
              />
            </button>
          ))}
      </div>

    </div>
  );
});

