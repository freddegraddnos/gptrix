/**
 * True-scale export.
 *
 * The rule is the same as for printing: one millimetre of artwork must measure
 * one millimetre on paper. For PDF that is trivial — the image box is declared
 * in millimetres. For raster formats we embed the physical resolution in the
 * file itself (PNG `pHYs`, JPEG JFIF density), so Photoshop, Preview, Windows
 * Photos and every print driver open the file at its real size instead of
 * guessing 72 dpi.
 */
import { jsPDF } from "jspdf";
import { PAPER_SIZES } from "./document";
import type { Orientation, PaperId } from "./print";

export type ExportFormat = "png" | "jpeg" | "pdf";

export const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string }[] = [
  { id: "png", label: "PNG", ext: "png" },
  { id: "jpeg", label: "JPEG", ext: "jpg" },
  { id: "pdf", label: "PDF", ext: "pdf" },
];

/* ------------------------------------------------------------------ bytes */

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBlobUrl(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* -------------------------------------------------------------- raster dpi */

/** Inserts (or replaces) a PNG `pHYs` chunk so the file carries its real dpi. */
export function pngWithDensity(pngBytes: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.max(1, Math.round((dpi / 25.4) * 1000));
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  // Signature (8) + IHDR (4 length + 4 type + 13 data + 4 crc) = 33 bytes.
  const head = 33;
  if (pngBytes.length < head) return pngBytes;
  const out = new Uint8Array(pngBytes.length + chunk.length);
  out.set(pngBytes.subarray(0, head), 0);
  out.set(chunk, head);
  out.set(pngBytes.subarray(head), head + chunk.length);
  return out;
}

/** Patches the JFIF APP0 density fields of a canvas JPEG to real dots per inch. */
export function jpegWithDensity(jpegBytes: Uint8Array, dpi: number): Uint8Array {
  const out = jpegBytes.slice();
  const isJfif =
    out[0] === 0xff &&
    out[1] === 0xd8 &&
    out[2] === 0xff &&
    out[3] === 0xe0 &&
    out[6] === 0x4a &&
    out[7] === 0x46 &&
    out[8] === 0x49 &&
    out[9] === 0x46;
  if (!isJfif) return out;
  const density = Math.max(1, Math.min(65535, Math.round(dpi)));
  out[13] = 1; // units: dots per inch
  out[14] = (density >> 8) & 0xff;
  out[15] = density & 0xff;
  out[16] = (density >> 8) & 0xff;
  out[17] = density & 0xff;
  return out;
}

/* ------------------------------------------------------------------ helpers */

/** Flattens a (possibly transparent) canvas onto white — JPEG has no alpha. */
function onWhite(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);
  return out;
}

function triggerDownload(href: string, filename: string, revoke: boolean) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export interface TrueScaleExport {
  canvas: HTMLCanvasElement;
  /** Physical size of the canvas in millimetres. */
  widthMm: number;
  heightMm: number;
  format: ExportFormat;
  /** Sheet used for PDF. */
  paper: PaperId;
  filename: string;
  /** Keep transparency when the format allows it (PNG only). */
  transparent?: boolean;
  /** Draws a 50 mm control bar on the PDF so the print can be measured. */
  ruler?: boolean;
  title?: string;
}

export interface ExportResult {
  ok: boolean;
  /** True when the artwork had to be placed on a larger/rotated sheet. */
  orientation?: Orientation;
  fits?: boolean;
  dpi: number;
}

/**
 * Writes the canvas to disk at exact physical scale.
 * PNG/JPEG carry an embedded dpi; PDF places the image in a millimetre box.
 */
export function exportTrueScale(options: TrueScaleExport): ExportResult {
  const { canvas, widthMm, heightMm, format, paper, filename } = options;
  const dpi = widthMm > 0 ? (canvas.width / widthMm) * 25.4 : 300;

  if (format === "pdf") {
    const sheet = PAPER_SIZES[paper];
    const orientation: Orientation =
      widthMm > heightMm && widthMm > sheet.widthMm - 10 ? "landscape" : "portrait";
    const pageW = orientation === "portrait" ? sheet.widthMm : sheet.heightMm;
    const pageH = orientation === "portrait" ? sheet.heightMm : sheet.widthMm;

    const doc = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation });
    const x = Math.max(5, (pageW - widthMm) / 2);
    const y = Math.max(5, (pageH - heightMm) / 2);
    doc.addImage(onWhite(canvas).toDataURL("image/jpeg", 0.95), "JPEG", x, y, widthMm, heightMm);

    if (options.ruler !== false) {
      // 50 mm control bar: if this measures 50 mm on paper, the scale is right.
      const by = pageH - 10;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(10, by, 60, by);
      doc.line(10, by - 2, 10, by + 2);
      doc.line(60, by - 2, 60, by + 2);
      doc.setFontSize(7);
      doc.text("50 mm · print at 100% (no fit to page)", 63, by + 1);
    }

    doc.save(filename);
    return {
      ok: true,
      orientation,
      fits: widthMm <= pageW - 10 && heightMm <= pageH - 10,
      dpi,
    };
  }

  if (format === "jpeg") {
    const bytes = jpegWithDensity(
      dataUrlToBytes(onWhite(canvas).toDataURL("image/jpeg", 0.95)),
      dpi,
    );
    triggerDownload(bytesToBlobUrl(bytes, "image/jpeg"), filename, true);
    return { ok: true, dpi };
  }

  const source = options.transparent === false ? onWhite(canvas) : canvas;
  const bytes = pngWithDensity(dataUrlToBytes(source.toDataURL("image/png")), dpi);
  triggerDownload(bytesToBlobUrl(bytes, "image/png"), filename, true);
  return { ok: true, dpi };
}

export function extensionFor(format: ExportFormat): string {
  return EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "png";
}
