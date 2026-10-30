import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileDown, FlipHorizontal, Loader2, Printer, RotateCcw, RotateCw, Ruler } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { PageRuler } from "./PageRuler";
import { tx } from "@/lib/uiLang";
import {
  DPI, OVERLAP_MM, fitsOnPage, fromMm, mmToPx, pageSize, pngWithDpi, rotatedBox, tileGrid, toMm,
  type Orientation, type PaperId, type Unit,
} from "@/lib/paint/printLayout";

type Props = {
  preview: HTMLCanvasElement;
  aspect: number; // height / width
  getStencil: (widthMm: number, heightMm: number) => Promise<HTMLCanvasElement>;
  onBack: () => void;
};

/** One printable page: optional raster at mm position, optional crop marks / label / calibration art. */
type Page = {
  w: number; h: number;
  img?: { url: string; x: number; y: number; w: number; h: number };
  crop?: { x: number; y: number; w: number; h: number };
  label?: string;
  calibration?: boolean;
};

const MAX_MM = 600;

export function StencilPrint({ preview, aspect, getStencil, onBack }: Props) {
  const [unit, setUnit] = useState<Unit>("cm");
  const [axis, setAxis] = useState<"width" | "height">("width");
  const [widthMm, setWidthMm] = useState(100);
  const [paper, setPaper] = useState<PaperId>("A4");
  const [orient, setOrient] = useState<Orientation>("portrait");
  const [rot, setRot] = useState(0);
  const [flip, setFlip] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const heightMm = widthMm * aspect;
  const page = pageSize(paper, orient);
  const box = rotatedBox(widthMm, heightMm, rot);
  const tiled = !fitsOnPage(box.w, box.h, page.w, page.h);
  const grid = useMemo(() => tileGrid(box.w, box.h, page.w, page.h), [box.w, box.h, page.w, page.h]);
  const center = pos ?? { x: page.w / 2, y: page.h / 2 };

  // keep stencil on page when size/paper changes
  useEffect(() => {
    setPos((p) => p && {
      x: Math.min(page.w - box.w / 2, Math.max(box.w / 2, p.x)),
      y: Math.min(page.h - box.h / 2, Math.max(box.h / 2, p.y)),
    });
  }, [page.w, page.h, box.w, box.h]);

  const shown = axis === "width" ? widthMm : heightMm;
  const setDim = (mm: number) => {
    const v = axis === "width" ? mm : mm / aspect;
    const maxW = Math.min(MAX_MM, MAX_MM / aspect);
    setWidthMm(Math.max(5, Math.min(maxW, v)));
  };

  // --- drag on page preview ---
  const pageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (tiled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, cx: center.x, cy: center.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, el = pageRef.current;
    if (!d || !el) return;
    const k = page.w / el.clientWidth;
    setPos({
      x: Math.min(page.w - box.w / 2, Math.max(box.w / 2, d.cx + (e.clientX - d.sx) * k)),
      y: Math.min(page.h - box.h / 2, Math.max(box.h / 2, d.cy + (e.clientY - d.sy) * k)),
    });
  };

  // --- rendering ---
  /** Stencil rotated/mirrored into its bounding box at 300 DPI. */
  const renderPlaced = async () => {
    const s = await getStencil(widthMm, heightMm);
    const c = document.createElement("canvas");
    c.width = mmToPx(box.w); c.height = mmToPx(box.h);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(flip ? -1 : 1, 1);
    const w = mmToPx(widthMm), h = mmToPx(heightMm);
    ctx.drawImage(s, -w / 2, -h / 2, w, h);
    // re-binarize after resampling: pure black or transparent
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < d.data.length; i += 4) { d.data[i - 3] = d.data[i - 2] = d.data[i - 1] = 0; d.data[i] = d.data[i] >= 128 ? 255 : 0; }
    ctx.putImageData(d, 0, 0);
    return c;
  };

  const buildPages = async (): Promise<Page[]> => {
    const placed = await renderPlaced();
    if (!tiled) {
      return [{ ...page, img: { url: placed.toDataURL("image/png"), x: center.x - box.w / 2, y: center.y - box.h / 2, w: box.w, h: box.h } }];
    }
    return grid.tiles.map((t) => {
      const piece = document.createElement("canvas");
      piece.width = mmToPx(t.wMm); piece.height = mmToPx(t.hMm);
      piece.getContext("2d")!.drawImage(placed, -mmToPx(t.xMm), -mmToPx(t.yMm));
      const m = grid.margin;
      return { ...page, label: t.label, crop: { x: m, y: m, w: grid.areaW, h: grid.areaH }, img: { url: piece.toDataURL("image/png"), x: m, y: m, w: t.wMm, h: t.hMm } };
    });
  };

  const calibrationPage = (): Page => ({ ...page, calibration: true });

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(`${label} failed. ${e instanceof Error ? e.message : ""}`); } finally { setBusy(null); }
  };

  const download = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const toPdf = async (pages: Page[], name: string) => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: [page.w, page.h], orientation: orient });
    pages.forEach((p, i) => {
      if (i) pdf.addPage([p.w, p.h], orient);
      if (p.img) pdf.addImage(p.img.url, "PNG", p.img.x, p.img.y, p.img.w, p.img.h, undefined, "NONE");
      if (p.crop) drawCropPdf(pdf, p);
      if (p.calibration) drawCalibrationPdf(pdf, p);
    });
    download(pdf.output("blob"), name);
  };

  const exportPdf = () => run("PDF export", async () => toPdf(await buildPages(), `stencil-${Math.round(widthMm)}x${Math.round(heightMm)}mm.pdf`));
  const exportCalibration = () => run("Calibration PDF", async () => toPdf([calibrationPage()], "print-calibration-test.pdf"));

  const exportPng = () => run("PNG export", async () => {
    const c = await renderPlaced();
    const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("Canvas empty"))), "image/png"));
    const bytes = pngWithDpi(new Uint8Array(await blob.arrayBuffer()), DPI);
    download(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }), `stencil-${Math.round(widthMm)}mm-${DPI}dpi.png`);
  });

  const exportSvg = () => run("SVG export", async () => {
    const c = await renderPlaced();
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${box.w.toFixed(2)}mm" height="${box.h.toFixed(2)}mm" viewBox="0 0 ${box.w.toFixed(2)} ${box.h.toFixed(2)}"><image width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" image-rendering="pixelated" xlink:href="${c.toDataURL("image/png")}"/></svg>`;
    download(new Blob([svg], { type: "image/svg+xml" }), `stencil-${Math.round(widthMm)}mm.svg`);
  });

  const printPages = (pages: Page[]) => {
    const html = `<!doctype html><html><head><title>Stencil</title><style>
      @page { size: ${page.w}mm ${page.h}mm; margin: 0; }
      html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .p{position:relative;width:${page.w}mm;height:${page.h}mm;overflow:hidden;page-break-after:always;break-after:page}
      .p:last-child{page-break-after:auto;break-after:auto}
      img{position:absolute;image-rendering:pixelated}
      svg{position:absolute;left:0;top:0}
    </style></head><body>${pages.map(pageHtml).join("")}</body></html>`;
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    const doc = f.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    const go = () => { f.contentWindow?.focus(); f.contentWindow?.print(); setTimeout(() => f.remove(), 60000); };
    const imgs = Array.from(doc.images);
    Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = r; })))).then(go);
  };

  const print = () => run("Print", async () => printPages(await buildPages()));
  const printCalibration = () => printPages([calibrationPage()]);

  // --- preview geometry (percent of page) ---
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-[1fr_340px]">
      <section className="flex flex-col items-center gap-2">
        <div className="grid w-full max-w-md grid-cols-[36px_minmax(0,1fr)] grid-rows-[auto_30px] gap-1">
        <div className="relative min-h-0"><div className="absolute inset-0"><PageRuler lengthMm={page.h} vertical /></div></div>
        <div
          ref={pageRef}
          className="relative w-full touch-none overflow-hidden border border-border bg-stencil-paper text-paper-ink shadow-sm"
          style={{ aspectRatio: `${page.w} / ${page.h}` }}
          aria-label="Page preview"
        >
          {!tiled && (
            <div
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)}
              className="absolute cursor-move outline outline-1 outline-dashed outline-primary/50"
              style={{ left: pct(center.x - box.w / 2, page.w), top: pct(center.y - box.h / 2, page.h), width: pct(box.w, page.w), height: pct(box.h, page.h) }}
            >
              <img
                src={preview.toDataURL()} alt="Stencil" draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{ width: `${(widthMm / box.w) * 100}%`, height: `${(heightMm / box.h) * 100}%`, transform: `translate(-50%,-50%) rotate(${rot}deg) scaleX(${flip ? -1 : 1})` }}
              />
            </div>
          )}
          {tiled && (
            <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm">
              <div>
                <p className="font-mono">{grid.tiles.length} pages ({grid.rows} × {grid.cols})</p>
                <p className="text-xs text-muted-foreground">Larger than one page — tiled with {OVERLAP_MM} mm overlap, crop marks and labels {grid.tiles[0]?.label}–{grid.tiles[grid.tiles.length - 1]?.label}.</p>
              </div>
            </div>
          )}
        </div>
        <span className="self-center text-right font-mono text-[10px] text-muted-foreground">cm</span>
        <PageRuler lengthMm={page.w} />
        </div>
        <p className="text-xs text-muted-foreground">{tiled ? "Tiled print" : "Drag the stencil to position it on the page"} · {paper} {orient}</p>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">{tx("Motif size (aspect ratio locked)")}</span>
          <div className="flex gap-2">
            <Seg value={axis} options={[["width", "Width"], ["height", "Height"]]} onChange={setAxis} />
            <Seg value={unit} options={[["mm", "mm"], ["cm", "cm"], ["in", "in"]]} onChange={setUnit} />
          </div>
          <input
            type="number" inputMode="decimal" min={0} step={unit === "mm" ? 1 : 0.1}
            value={Number(fromMm(shown, unit).toFixed(unit === "mm" ? 0 : 2))}
            onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) setDim(toMm(v, unit)); }}
            className="min-h-11 rounded-xl border border-border bg-background px-3 font-mono"
            aria-label={`Stencil ${axis} in ${unit}`}
          />
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((cm) => (
              <button key={cm} type="button" onClick={() => setDim(cm * 10)}
                className={`min-h-11 rounded-xl border text-sm ${Math.abs(shown - cm * 10) < 0.5 ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}>
                {cm} cm
              </button>
            ))}
          </div>
          <p className="font-mono text-sm">{Math.round(widthMm)} × {Math.round(heightMm)} mm</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Paper</span>
          <Seg value={paper} options={[["A4", "A4"], ["A3", "A3"], ["Letter", "Letter"]]} onChange={setPaper} />
          <Seg value={orient} options={[["portrait", "Portrait"], ["landscape", "Landscape"]]} onChange={setOrient} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Rotation</span><span className="font-mono">{rot}°</span></div>
          <div className="flex items-center gap-2">
            <IconBtn label="Rotate left 90°" onClick={() => setRot((r) => ((r - 90 + 540) % 360) - 180)}><RotateCcw className="h-4 w-4" /></IconBtn>
            <div className="flex min-h-11 flex-1 items-center"><Slider value={[rot]} min={-180} max={180} step={1} onValueChange={([v]) => setRot(v ?? 0)} aria-label="Rotation" /></div>
            <IconBtn label="Rotate right 90°" onClick={() => setRot((r) => ((r + 90 + 540) % 360) - 180)}><RotateCw className="h-4 w-4" /></IconBtn>
            <IconBtn label="Mirror" active={flip} onClick={() => setFlip((f) => !f)}><FlipHorizontal className="h-4 w-4" /></IconBtn>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!!busy} onClick={print} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
            {busy === "Print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print
          </button>
          <button type="button" disabled={!!busy} onClick={exportPdf} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border hover:bg-accent disabled:opacity-50">
            {busy === "PDF export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
          </button>
          <button type="button" disabled={!!busy} onClick={exportPng} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border hover:bg-accent disabled:opacity-50">
            {busy === "PNG export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PNG
          </button>
          <button type="button" disabled={!!busy} onClick={exportSvg} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border hover:bg-accent disabled:opacity-50">
            {busy === "SVG export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} SVG
          </button>
        </div>
        <p className="rounded-xl border border-border p-3 text-xs">Tip: in the print dialog, set scale to <b>100% / Actual size</b>.</p>

        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <span className="flex items-center gap-2 text-sm"><Ruler className="h-4 w-4" /> Print calibration test</span>
          <p className="text-xs text-muted-foreground">Prints a 50 mm square and a ruler. Measure them on paper to check the scale.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={printCalibration} className="min-h-11 rounded-xl border border-border text-sm hover:bg-accent">Print test</button>
            <button type="button" disabled={!!busy} onClick={exportCalibration} className="min-h-11 rounded-xl border border-border text-sm hover:bg-accent disabled:opacity-50">Test PDF</button>
          </div>
        </div>

        <button type="button" onClick={onBack} className="min-h-11 rounded-xl border border-border hover:bg-accent">Back to Refine</button>
      </aside>
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-1 rounded-xl border border-border p-0.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          className={`min-h-11 flex-1 rounded-lg text-sm ${value === v ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{l}</button>
      ))}
    </div>
  );
}

function IconBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} aria-pressed={active} onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-xl border ${active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}>{children}</button>
  );
}

// ---------- shared page art ----------
const CROP_LEN = 6;
function cropLines(c: NonNullable<Page["crop"]>): [number, number, number, number][] {
  const L: [number, number, number, number][] = [];
  for (const x of [c.x, c.x + c.w]) for (const y of [c.y, c.y + c.h]) {
    const dx = x === c.x ? -1 : 1, dy = y === c.y ? -1 : 1;
    L.push([x + dx, y, x + dx * (1 + CROP_LEN), y], [x, y + dy, x, y + dy * (1 + CROP_LEN)]);
  }
  return L;
}
function rulerTicks(): { x: number; len: number; n?: number }[] {
  return Array.from({ length: 151 }, (_, i) => ({ x: i, len: i % 10 === 0 ? 6 : i % 5 === 0 ? 4 : 2, n: i % 10 === 0 ? i / 10 : undefined }));
}
const CAL = { sq: 50, sx: 20, sy: 30, rx: 20, ry: 110 };

type PdfLike = { setLineWidth(w: number): unknown; line(a: number, b: number, c: number, d: number): unknown; rect(a: number, b: number, c: number, d: number): unknown; setFontSize(n: number): unknown; text(t: string, x: number, y: number): unknown };
function drawCropPdf(pdf: PdfLike, p: Page) {
  pdf.setLineWidth(0.2);
  for (const l of cropLines(p.crop!)) pdf.line(...l);
  pdf.setFontSize(10);
  pdf.text(`${p.label}  ·  overlap ${OVERLAP_MM} mm`, p.crop!.x, p.crop!.y - 3);
}
function drawCalibrationPdf(pdf: PdfLike, p: Page) {
  pdf.setLineWidth(0.3);
  pdf.setFontSize(12);
  pdf.text("Print calibration test — print at 100% / Actual size", CAL.sx, 18);
  pdf.rect(CAL.sx, CAL.sy, CAL.sq, CAL.sq);
  pdf.setFontSize(9);
  pdf.text("50 × 50 mm", CAL.sx + CAL.sq + 4, CAL.sy + CAL.sq / 2);
  const len = Math.min(150, p.w - 2 * CAL.rx);
  pdf.line(CAL.rx, CAL.ry, CAL.rx + len, CAL.ry);
  pdf.setLineWidth(0.15);
  for (const t of rulerTicks()) if (t.x <= len) {
    pdf.line(CAL.rx + t.x, CAL.ry, CAL.rx + t.x, CAL.ry + t.len);
    if (t.n !== undefined) pdf.text(String(t.n), CAL.rx + t.x - 1, CAL.ry + 10);
  }
  pdf.text("cm", CAL.rx + len + 3, CAL.ry + 4);
}

function pageHtml(p: Page) {
  let svg = "";
  if (p.crop) {
    svg += cropLines(p.crop).map(([a, b, c, d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#000" stroke-width="0.2"/>`).join("");
    svg += `<text x="${p.crop.x}" y="${p.crop.y - 3}" font-size="3.5" font-family="monospace">${p.label} · overlap ${OVERLAP_MM} mm</text>`;
  }
  if (p.calibration) {
    const len = Math.min(150, p.w - 2 * CAL.rx);
    svg += `<text x="${CAL.sx}" y="18" font-size="4.2" font-family="monospace">Print calibration test — print at 100% / Actual size</text>`;
    svg += `<rect x="${CAL.sx}" y="${CAL.sy}" width="${CAL.sq}" height="${CAL.sq}" fill="none" stroke="#000" stroke-width="0.3"/>`;
    svg += `<text x="${CAL.sx + CAL.sq + 4}" y="${CAL.sy + CAL.sq / 2}" font-size="3.2" font-family="monospace">50 × 50 mm</text>`;
    svg += `<line x1="${CAL.rx}" y1="${CAL.ry}" x2="${CAL.rx + len}" y2="${CAL.ry}" stroke="#000" stroke-width="0.3"/>`;
    for (const t of rulerTicks()) if (t.x <= len) {
      svg += `<line x1="${CAL.rx + t.x}" y1="${CAL.ry}" x2="${CAL.rx + t.x}" y2="${CAL.ry + t.len}" stroke="#000" stroke-width="0.15"/>`;
      if (t.n !== undefined) svg += `<text x="${CAL.rx + t.x - 1}" y="${CAL.ry + 10}" font-size="3" font-family="monospace">${t.n}</text>`;
    }
  }
  const img = p.img ? `<img src="${p.img.url}" style="left:${p.img.x}mm;top:${p.img.y}mm;width:${p.img.w}mm;height:${p.img.h}mm">` : "";
  return `<div class="p">${img}<svg width="${p.w}mm" height="${p.h}mm" viewBox="0 0 ${p.w} ${p.h}">${svg}</svg></div>`;
}
