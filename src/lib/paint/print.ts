/**
 * True-scale printing.
 *
 * The rule: one millimetre of artwork must measure one millimetre on paper.
 * We never let the browser "fit to page" — the image is placed in a sheet-sized
 * page box with its width and height declared in millimetres, derived straight
 * from the document's `mmPerPixel`. The printer dialog must be left at 100 %
 * scale (no "fit to printable area") for that to hold, which the sheet itself
 * states in a corner note that we keep outside the artwork area.
 */
import { PAPER_SIZES } from "./document";

export type PaperId = keyof typeof PAPER_SIZES;
export type Orientation = "portrait" | "landscape";

export interface PrintOptions {
  dataUrl: string;
  /** Physical artwork size in millimetres. */
  widthMm: number;
  heightMm: number;
  paper: PaperId;
  /** Auto picks the orientation that fits the artwork best. */
  orientation?: Orientation | "auto";
  title?: string;
  /** Prints a 50 mm calibration bar so the artist can verify true scale. */
  showRuler?: boolean;
}

export interface SheetSize {
  widthMm: number;
  heightMm: number;
}

export function sheetSize(paper: PaperId, orientation: Orientation): SheetSize {
  const { widthMm, heightMm } = PAPER_SIZES[paper];
  return orientation === "portrait"
    ? { widthMm, heightMm }
    : { widthMm: heightMm, heightMm: widthMm };
}

/** Orientation where the artwork has the most room at 1:1. */
export function bestOrientation(paper: PaperId, widthMm: number, heightMm: number): Orientation {
  const p = sheetSize(paper, "portrait");
  const l = sheetSize(paper, "landscape");
  const slack = (s: SheetSize) => Math.min(s.widthMm - widthMm, s.heightMm - heightMm);
  return slack(l) > slack(p) ? "landscape" : "portrait";
}

/** Does the artwork fit the sheet at exact scale (with a small print margin)? */
export function fitsSheet(
  paper: PaperId,
  orientation: Orientation,
  widthMm: number,
  heightMm: number,
  marginMm = 5,
): boolean {
  const s = sheetSize(paper, orientation);
  return widthMm <= s.widthMm - 2 * marginMm && heightMm <= s.heightMm - 2 * marginMm;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

/**
 * Opens a print sheet in a new window. Returns false when the browser blocked
 * the popup so the caller can tell the user.
 */
export function printAtActualSize(options: PrintOptions): boolean {
  const { dataUrl, widthMm, heightMm, paper, title = "Skiss", showRuler = false } = options;
  const orientation =
    !options.orientation || options.orientation === "auto"
      ? bestOrientation(paper, widthMm, heightMm)
      : options.orientation;
  const sheet = sheetSize(paper, orientation);

  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return false;

  const html = `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: ${paper.toUpperCase()} ${orientation}; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .sheet {
    position: relative;
    box-sizing: border-box;
    width: ${sheet.widthMm}mm;
    height: ${sheet.heightMm}mm;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  /* Exact physical size: mm in, mm out. No fitting, no upscaling. */
  .art { width: ${widthMm}mm; height: ${heightMm}mm; display: block; }
  .note {
    position: absolute;
    left: 4mm; bottom: 3mm;
    font: 7pt/1.2 -apple-system, Segoe UI, Roboto, sans-serif;
    color: #666;
  }
  @media print { .note { color: #999; } }
  /* 50 mm calibration bar: measure it with a ruler to confirm 100 % scale. */
  .ruler {
    position: absolute;
    right: 4mm; bottom: 3mm;
    width: 50mm;
    font: 6.5pt/1.2 -apple-system, Segoe UI, Roboto, sans-serif;
    color: #666;
    text-align: center;
  }
  .ruler .bar {
    height: 3mm;
    border: 0.3mm solid #666;
    border-top: none;
  }
</style>
</head>
<body>
  <div class="sheet">
    <img class="art" src="${dataUrl}" alt="${escapeHtml(title)}">
    ${showRuler ? '<div class="ruler"><div>50 mm</div><div class="bar"></div></div>' : ""}
    <div class="note">${widthMm.toFixed(1).replace(".", ",")} × ${heightMm
      .toFixed(1)
      .replace(".", ",")} mm — skriv ut i 100 % skala (ingen anpassning till sidan)</div>
  </div>
  <script>
    const img = document.querySelector('img');
    const go = () => setTimeout(() => { window.focus(); window.print(); }, 60);
    if (img.complete) go(); else img.onload = go;
  </script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
