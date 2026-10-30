// Pure print-layout math for Stencil "Size & Print". All lengths in millimetres.
export type Unit = "mm" | "cm" | "in";
export type PaperId = "A4" | "A3" | "Letter";
export type Orientation = "portrait" | "landscape";

export const DPI = 300;
export const OVERLAP_MM = 10;
export const TILE_MARGIN_MM = 10;
export const PAPERS: Record<PaperId, [number, number]> = { A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4] };
const PER_MM: Record<Unit, number> = { mm: 1, cm: 10, in: 25.4 };

export const toMm = (v: number, u: Unit) => v * PER_MM[u];
export const fromMm = (mm: number, u: Unit) => mm / PER_MM[u];
export const mmToPx = (mm: number, dpi = DPI) => Math.round((mm / 25.4) * dpi);

export function pageSize(paper: PaperId, o: Orientation): { w: number; h: number } {
  const [a, b] = PAPERS[paper];
  return o === "portrait" ? { w: a, h: b } : { w: b, h: a };
}

/** Axis-aligned bounding box of a w×h rectangle rotated by deg. */
export function rotatedBox(w: number, h: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  return { w: w * c + h * s, h: w * s + h * c };
}

export type Tile = { label: string; row: number; col: number; xMm: number; yMm: number; wMm: number; hMm: number };

/** Split a bw×bh design into page tiles with overlap. Rows are letters, columns numbers (A1, A2, B1…). */
export function tileGrid(bw: number, bh: number, pageW: number, pageH: number, overlap = OVERLAP_MM, margin = TILE_MARGIN_MM) {
  const aw = pageW - 2 * margin, ah = pageH - 2 * margin;
  const cols = bw <= aw ? 1 : Math.ceil((bw - overlap) / (aw - overlap));
  const rows = bh <= ah ? 1 : Math.ceil((bh - overlap) / (ah - overlap));
  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * (aw - overlap), y = r * (ah - overlap);
      tiles.push({ label: `${String.fromCharCode(65 + r)}${c + 1}`, row: r, col: c, xMm: x, yMm: y, wMm: Math.min(aw, bw - x), hMm: Math.min(ah, bh - y) });
    }
  return { rows, cols, tiles, areaW: aw, areaH: ah, margin };
}

export const fitsOnPage = (bw: number, bh: number, pageW: number, pageH: number) => bw <= pageW && bh <= pageH;

export function pageRulerTicks(lengthMm: number) {
  const ticks = Array.from({ length: Math.floor(lengthMm) + 1 }, (_, mm) => ({
    mm, major: mm % 10 === 0, medium: mm % 5 === 0,
    label: mm % 10 === 0 ? String(mm / 10) : undefined as string | undefined,
  }));
  const last = ticks[ticks.length - 1];
  if (last && last.mm === lengthMm) last.label = String(lengthMm / 10);
  else ticks.push({ mm: lengthMm, major: true, medium: true, label: String(Number((lengthMm / 10).toFixed(2))) });
  return ticks;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** Insert a pHYs chunk (DPI metadata) right after IHDR. */
export function pngWithDpi(png: Uint8Array, dpi = DPI): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const v = new DataView(chunk.buffer);
  v.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  v.setUint32(8, ppm); v.setUint32(12, ppm); chunk[16] = 1;
  v.setUint32(17, crc32(chunk.subarray(4, 17)));
  const at = 33; // 8 signature + 25 IHDR
  const out = new Uint8Array(png.length + 21);
  out.set(png.subarray(0, at)); out.set(chunk, at); out.set(png.subarray(at), at + 21);
  return out;
}
