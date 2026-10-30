import { createElement, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

/**
 * Minimal `<model-viewer>` wrapper so clients can look at a delivered 3D file
 * (GLB/GLTF) right in the app — rotate, zoom and AR on supported phones.
 * The web component is loaded lazily in the browser only.
 */
export function ModelViewerLite({
  src,
  alt = "3D model",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Loaded from a CDN script tag (never bundled) so the server build never
    // evaluates the web component — it references HTMLElement at import time.
    const done = () => alive && setReady(true);
    if (customElements.get("model-viewer")) {
      done();
    } else {
      const id = "model-viewer-cdn";
      let s = document.getElementById(id) as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement("script");
        s.id = id;
        s.type = "module";
        s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
        document.head.appendChild(s);
      }
      s.addEventListener("error", () => alive && setFailed(true));
      void customElements.whenDefined("model-viewer").then(done);
    }
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <div className={`grid place-items-center rounded-xl bg-ink/60 p-6 text-center ${className}`}>
        <p className="text-[11px] text-muted-foreground">
          The 3D viewer could not load. Download the file instead.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={`grid place-items-center rounded-xl bg-ink/60 ${className}`}>
        <Loader2 className="size-5 animate-spin text-accent" />
      </div>
    );
  }

  return createElement("model-viewer", {
    src,
    alt,
    "camera-controls": true,
    "touch-action": "pan-y",
    "shadow-intensity": "1",
    ar: true,
    "ar-modes": "webxr scene-viewer quick-look",
    autoplay: true,
    style: { width: "100%", height: "100%", background: "transparent" },
    class: `rounded-xl ${className}`,
  });
}

/** Fullscreen sheet with the 3D viewer inside. */
export function ModelViewerSheet({
  src,
  name,
  onClose,
}: {
  src: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-ink/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="truncate text-sm font-bold">{name}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close 3D viewer"
          className="grid size-9 place-items-center rounded-full border border-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 p-3">
        <ModelViewerLite src={src} alt={name} className="h-full w-full" />
      </div>
      <p className="px-4 pb-6 text-center text-[11px] text-muted-foreground">
        Drag to rotate · pinch to zoom · tap the AR icon to place it in your room.
      </p>
    </div>
  );
}
