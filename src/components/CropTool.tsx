import { useCallback, useEffect, useRef, useState } from "react";
import { X, ZoomIn, RotateCcw, ArrowLeft } from "lucide-react";

/**
 * Step 1 of the upload flow: zoom and pan the uploaded image inside a square
 * frame to crop it before it is applied as a tattoo motif.
 */
export function CropTool({
  src,
  onCancel,
  onDone,
}: {
  src: string;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
    image.onerror = () => setError("Could not read the image.");
    image.src = src;
  }, [src]);

  const clampZoom = (z: number) => Math.min(6, Math.max(0.5, z));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { dist: Math.hypot(b.x - a.x, b.y - a.y), zoom };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      setOffset((o) => ({
        x: o.x + (e.clientX - prev.x),
        y: o.y + (e.clientY - prev.y),
      }));
    } else if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      setZoom(clampZoom(pinch.current.zoom * (dist / pinch.current.dist)));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // Native non-passive wheel listener so trackpad/mouse zoom does not scroll the page.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setZoom((z) => clampZoom(z * Math.exp(-dy * 0.0015)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const apply = useCallback(() => {
    const frame = frameRef.current;
    if (!img || !frame) return;
    const rect = frame.getBoundingClientRect();
    const V = Math.min(rect.width, rect.height);
    const fit = V / Math.max(img.width, img.height);
    const OUT = 1024;
    const k = OUT / V;
    const dw = img.width * fit * zoom * k;
    const dh = img.height * fit * zoom * k;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      OUT / 2 + offset.x * k - dw / 2,
      OUT / 2 + offset.y * k - dh / 2,
      dw,
      dh,
    );
    onDone(canvas.toDataURL("image/png"));
  }, [img, zoom, offset, onDone]);

  const displayStyle = () => {
    if (!img) return undefined;
    const frame = frameRef.current;
    const V = frame
      ? Math.min(
          frame.getBoundingClientRect().width,
          frame.getBoundingClientRect().height,
        )
      : 0;
    const fit = V ? V / Math.max(img.width, img.height) : 0;
    return {
      width: img.width * fit * zoom,
      height: img.height * fit * zoom,
      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
    } as React.CSSProperties;
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-lg flex flex-col p-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="size-10 rounded-full glass grid place-items-center shrink-0"
            aria-label="Back to camera"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="text-mono-caps text-accent text-[10px]">
              Upload · Step 1
            </div>
            <h2 className="font-display font-bold text-lg">Zoom &amp; crop</h2>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="size-10 rounded-full glass grid place-items-center"
          aria-label="Cancel"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Pinch or scroll to zoom, drag to move. Everything inside the square is
        used as your motif.
      </p>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 mb-3 text-xs text-red-200">
          {error}
        </div>
      )}

      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative flex-1 min-h-[240px] aspect-square self-center w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10 touch-none select-none"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
          backgroundColor: "#0a0a0a",
        }}
      >
        {img && (
          <img
            src={src}
            alt="Crop preview"
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
            style={displayStyle()}
          />
        )}
        <div className="pointer-events-none absolute inset-4 border-2 border-accent/60 rounded-xl" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ZoomIn className="size-4 text-muted-foreground" />
        <input
          type="range"
          min={50}
          max={600}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(clampZoom(Number(e.target.value) / 100))}
          className="flex-1 accent-[color:var(--accent)]"
          aria-label="Zoom"
        />
        <span className="text-[11px] font-mono w-12 text-right">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
          className="size-9 rounded-full glass grid place-items-center"
          aria-label="Reset crop"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={onCancel}
          className="py-4 rounded-xl border border-white/15 bg-slate text-sm font-bold"
        >
          Cancel
        </button>
        <button
          onClick={apply}
          disabled={!img}
          className="py-4 rounded-xl bg-accent text-ink text-sm font-bold disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
