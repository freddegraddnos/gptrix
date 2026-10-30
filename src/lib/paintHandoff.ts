/**
 * Handoff between the rest of InkSimulator and the drawing studio (/rita).
 *
 * A caller stashes the image it wants prefilled, then navigates to /rita.
 * The studio picks the request up once, on mount, and clears it — so a plain
 * reload of /rita starts from the normal size dialog instead of re-importing.
 *
 * `background` = locked reference the artist draws on top of (3D scans).
 * `layer`      = an ordinary, editable layer (library motifs).
 */
export type PaintPrefillMode = "background" | "layer" | "project";

export type PaintPrefill = {
  /** Any URL the browser can load: data:, blob: or a signed https URL. */
  url: string;
  name: string;
  /** `project` points at a saved .inkproj.json with the full layer stack. */
  mode: PaintPrefillMode;
};


const KEY = "inkvision:paint-prefill";

export function setPaintPrefill(prefill: PaintPrefill) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(prefill));
  } catch {
    /* private mode / quota — the studio just opens empty */
  }
}

/**
 * Short-lived memory of the last taken request. React remounts the studio once
 * in development (StrictMode), and without this the second mount would find an
 * already-emptied sessionStorage and open a blank canvas.
 */
let recent: { at: number; value: PaintPrefill } | null = null;
const RECENT_MS = 5000;

/** Reads and removes the pending request. Returns null when there is none. */
export function takePaintPrefill(): PaintPrefill | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      if (recent && Date.now() - recent.at < RECENT_MS) return recent.value;
      return null;
    }
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<PaintPrefill>;
    const modes: PaintPrefillMode[] = ["background", "layer", "project"];
    if (!parsed?.url || !parsed.mode || !modes.includes(parsed.mode)) {
      return null;
    }
    const value: PaintPrefill = {
      url: parsed.url,
      name: parsed.name || "Image",
      mode: parsed.mode,
    };
    recent = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ saving */

/**
 * Where the drawing studio should deliver finished artwork. Set by a booking
 * before navigating to /rita; it survives reloads inside the studio and is
 * cleared explicitly when the artist leaves the booking context.
 */
export type PaintSaveTarget = {
  slotId: string;
  role: "studio" | "client";
  /** Human label shown in the studio, e.g. the client or studio name. */
  label?: string;
};

const TARGET_KEY = "inkvision:paint-save-target";

export function setPaintSaveTarget(target: PaintSaveTarget) {
  try {
    sessionStorage.setItem(TARGET_KEY, JSON.stringify(target));
  } catch {
    /* private mode — saving to the booking is simply unavailable */
  }
}

export function getPaintSaveTarget(): PaintSaveTarget | null {
  try {
    const raw = sessionStorage.getItem(TARGET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PaintSaveTarget>;
    if (!parsed?.slotId || (parsed.role !== "studio" && parsed.role !== "client")) return null;
    return { slotId: parsed.slotId, role: parsed.role, label: parsed.label };
  } catch {
    return null;
  }
}

export function clearPaintSaveTarget() {
  try {
    sessionStorage.removeItem(TARGET_KEY);
  } catch {
    /* ignore */
  }
}

/* ----------------------------------------------------------------- leaving */

/**
 * Where the studio's back button should return to. Set by whatever navigated
 * into /rita; only same-origin paths are accepted, and never /rita itself.
 */
const RETURN_KEY = "inkvision:paint-return-to";

function isSafePath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/rita")
  );
}

/** Remembers the current page as the studio's "back" destination. */
export function setPaintReturnTo(path?: string) {
  try {
    const target =
      path ??
      (typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "");
    if (!target || !isSafePath(target)) return;
    sessionStorage.setItem(RETURN_KEY, target);
  } catch {
    /* private mode — the studio just shows the generic exit menu */
  }
}

export function getPaintReturnTo(): string | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    return raw && isSafePath(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function clearPaintReturnTo() {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }
}



/* ------------------------------------------------- open the motif library */

const MOTIFS_KEY = "inkvision:paint-open-motifs";

/** Asks the studio to open the motif library as soon as it mounts. */
export function requestPaintMotifLibrary() {
  try {
    sessionStorage.setItem(MOTIFS_KEY, "1");
  } catch {
    /* private mode — the studio just opens normally */
  }
}

/** Reads and clears the request above. */
export function takePaintMotifLibraryRequest(): boolean {
  try {
    const raw = sessionStorage.getItem(MOTIFS_KEY);
    if (raw) sessionStorage.removeItem(MOTIFS_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

/* ------------------------------------------------- open the stencil tool */

const STENCIL_KEY = "inkvision:paint-open-stencil";

/** Asks the studio to open the stencil tool as soon as it mounts. */
export function requestPaintStencil() {
  try {
    sessionStorage.setItem(STENCIL_KEY, "1");
  } catch {
    /* private mode — the studio just opens normally */
  }
}

/** Reads and clears the request above. */
export function takePaintStencilRequest(): boolean {
  try {
    const raw = sessionStorage.getItem(STENCIL_KEY);
    if (raw) sessionStorage.removeItem(STENCIL_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}
