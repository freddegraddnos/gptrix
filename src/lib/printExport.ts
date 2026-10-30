import { jsPDF } from "jspdf";

export type PaperId = "a4" | "letter";

export const PAPERS: { id: PaperId; label: string; wMm: number; hMm: number }[] =
  [
    { id: "a4", label: "A4", wMm: 210, hMm: 297 },
    { id: "letter", label: "US Letter", wMm: 215.9, hMm: 279.4 },
  ];

export type PrintSheetOptions = {
  /** Source image (motif / AR capture). */
  imageUrl: string;
  /** Measured print width in centimetres (1:1 scale). */
  widthCm: number;
  paper: PaperId;
  /** Mirror horizontally — needed for hand-applied stencil transfer. */
  mirror?: boolean;
  /** Render as high-contrast black line art. */
  stencil?: boolean;
  title?: string;
  bodyPart?: string | null;
  note?: string | null;
  /** Optional still of the locked AR placement, printed as a reference photo. */
  photoUrl?: string | null;
  /** Sheet orientation; "auto" picks landscape for wide motifs. */
  orientation?: "auto" | "portrait" | "landscape";
  dpi?: number;
};


const MM_PER_IN = 25.4;

export function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image"));
    img.src = url;
  });
}

/** Height in cm the motif gets when scaled to `widthCm`, keeping aspect ratio. */
export function measuredHeightCm(img: HTMLImageElement, widthCm: number) {
  return (img.naturalHeight / img.naturalWidth) * widthCm;
}

function applyStencil(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const data = ctx.getImageData(x, y, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 24) {
      d[i + 3] = 0;
      continue;
    }
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const on = lum < 170;
    d[i] = d[i + 1] = d[i + 2] = 0;
    d[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(data, x, y);
}

/**
 * Renders a true-to-scale, print-ready sheet: the motif at its measured size,
 * a centimetre ruler, crop marks and a spec footer.
 */
export async function renderPrintSheet(opts: PrintSheetOptions): Promise<{
  canvas: HTMLCanvasElement;
  widthCm: number;
  heightCm: number;
  paper: { wMm: number; hMm: number };
  orientation: "portrait" | "landscape";
  fits: boolean;
}> {
  const dpi = opts.dpi ?? 300;
  const base = PAPERS.find((p) => p.id === opts.paper) ?? PAPERS[0];
  const px = (mm: number) => Math.round((mm / MM_PER_IN) * dpi);

  const img = await loadImageEl(opts.imageUrl);
  const wCm = Math.max(0.5, opts.widthCm);
  const hCm = measuredHeightCm(img, wCm);

  const requested = opts.orientation ?? "auto";
  const landscape =
    requested === "landscape" || (requested === "auto" && wCm > hCm * 1.05);
  const paper = landscape
    ? { ...base, wMm: base.hMm, hMm: base.wMm }
    : { ...base };

  const canvas = document.createElement("canvas");
  canvas.width = px(paper.wMm);
  canvas.height = px(paper.hMm);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const marginMm = 14;
  const rulerMm = 10;
  const headerMm = 22;
  const footerMm = 46;

  const areaX = marginMm + rulerMm;
  const areaY = marginMm + headerMm + rulerMm;
  const areaW = paper.wMm - areaX - marginMm;
  const areaH = paper.hMm - areaY - marginMm - footerMm;

  const drawWmm = wCm * 10;
  const drawHmm = hCm * 10;
  const fits = drawWmm <= areaW && drawHmm <= areaH;


  // Header
  ctx.fillStyle = "#0A0A0B";
  ctx.font = `700 ${px(6)}px "Space Grotesk", Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("INKSIMULATOR", px(marginMm), px(marginMm + 6));
  ctx.fillStyle = "#6B7280";
  ctx.font = `400 ${px(3.2)}px Helvetica, Arial, sans-serif`;
  ctx.fillText(
    "Print at 100% / actual size — do not scale to fit",
    px(marginMm),
    px(marginMm + 11),
  );
  ctx.fillStyle = "#0A0A0B";
  ctx.font = `700 ${px(4.2)}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(
    `${wCm.toFixed(1)} × ${hCm.toFixed(1)} cm`,
    px(paper.wMm - marginMm),
    px(marginMm + 6),
  );
  ctx.font = `400 ${px(3.2)}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "#6B7280";
  ctx.fillText(
    opts.title ? opts.title : "Tattoo stencil",
    px(paper.wMm - marginMm),
    px(marginMm + 11),
  );
  ctx.textAlign = "left";

  // Rulers (cm ticks) along the top and left of the placement area
  ctx.strokeStyle = "#0A0A0B";
  ctx.fillStyle = "#0A0A0B";
  ctx.lineWidth = Math.max(1, px(0.2));
  ctx.font = `400 ${px(2.4)}px Helvetica, Arial, sans-serif`;

  const topCm = Math.floor(areaW / 10);
  for (let c = 0; c <= topCm; c++) {
    const x = px(areaX + c * 10);
    const len = c % 5 === 0 ? rulerMm : rulerMm * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, px(areaY));
    ctx.lineTo(x, px(areaY - len));
    ctx.stroke();
    if (c % 5 === 0 && c > 0) ctx.fillText(`${c}`, x + px(0.8), px(areaY - len + 3));
  }
  const leftCm = Math.floor(areaH / 10);
  for (let c = 0; c <= leftCm; c++) {
    const y = px(areaY + c * 10);
    const len = c % 5 === 0 ? rulerMm : rulerMm * 0.5;
    ctx.beginPath();
    ctx.moveTo(px(areaX), y);
    ctx.lineTo(px(areaX - len), y);
    ctx.stroke();
    if (c % 5 === 0 && c > 0) ctx.fillText(`${c}`, px(areaX - len), y - px(1));
  }

  // Clear print frame around the 1:1 placement area
  ctx.strokeStyle = "#0A0A0B";
  ctx.lineWidth = Math.max(1, px(0.4));
  ctx.strokeRect(px(areaX), px(areaY), px(areaW), px(areaH));
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(px(areaX + 1), px(areaY + 1), px(48), px(5));
  ctx.fillStyle = "#0A0A0B";
  ctx.font = `700 ${px(2.8)}px Helvetica, Arial, sans-serif`;
  ctx.fillText("1:1 PRINT AREA — DO NOT SCALE", px(areaX + 3), px(areaY + 4.6));


  // Motif, centred in the placement area at exact measured size

  const scale = fits ? 1 : Math.min(areaW / drawWmm, areaH / drawHmm);
  const finalW = drawWmm * scale;
  const finalH = drawHmm * scale;
  const dx = areaX + (areaW - finalW) / 2;
  const dy = areaY + (areaH - finalH) / 2;

  ctx.save();
  if (opts.mirror) {
    ctx.translate(px(dx) * 2 + px(finalW), 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, px(dx), px(dy), px(finalW), px(finalH));
  ctx.restore();

  if (opts.stencil) {
    applyStencil(ctx, px(dx), px(dy), px(finalW), px(finalH));
  }

  // Crop marks around the motif bounds
  ctx.strokeStyle = "#9CA3AF";
  ctx.lineWidth = Math.max(1, px(0.15));
  const mark = px(4);
  const corners: [number, number, number, number][] = [
    [px(dx), px(dy), 1, 1],
    [px(dx + finalW), px(dy), -1, 1],
    [px(dx), px(dy + finalH), 1, -1],
    [px(dx + finalW), px(dy + finalH), -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx - sx * px(1.5), cy);
    ctx.lineTo(cx - sx * px(1.5) - sx * mark, cy);
    ctx.moveTo(cx, cy - sy * px(1.5));
    ctx.lineTo(cx, cy - sy * px(1.5) - sy * mark);
    ctx.stroke();
  }

  // Calibration reference bar (10 cm) in the footer
  const fy = paper.hMm - footerMm + 4;
  ctx.strokeStyle = "#0A0A0B";
  ctx.lineWidth = Math.max(1, px(0.3));
  ctx.beginPath();
  ctx.moveTo(px(marginMm), px(fy));
  ctx.lineTo(px(marginMm + 100), px(fy));
  ctx.stroke();
  for (let c = 0; c <= 10; c++) {
    const x = px(marginMm + c * 10);
    ctx.beginPath();
    ctx.moveTo(x, px(fy));
    ctx.lineTo(x, px(fy - (c % 5 === 0 ? 3 : 2)));
    ctx.stroke();
  }
  ctx.fillStyle = "#6B7280";
  ctx.font = `400 ${px(3)}px Helvetica, Arial, sans-serif`;
  ctx.fillText(
    "Measure this bar — it must be exactly 10 cm",
    px(marginMm),
    px(fy + 5),
  );

  const specs = [
    `Width ${wCm.toFixed(1)} cm (${Math.round(wCm * 10)} mm)`,
    `Height ${hCm.toFixed(1)} cm (${Math.round(hCm * 10)} mm)`,
    opts.bodyPart ? `Placement: ${opts.bodyPart}` : null,
    opts.mirror ? "Mirrored for transfer" : null,
  ].filter(Boolean) as string[];
  const specLines = [
    specs.join("  ·  "),
    `Scale 1:1 · ${paper.label} ${landscape ? "landscape" : "portrait"} · ${dpi} dpi`,
  ];
  if (opts.note) specLines.push(opts.note.slice(0, 110));

  const maxTextMm = 98;
  const fitText = (text: string, sizeMm: number) => {
    let size = sizeMm;
    ctx.font = `400 ${px(size)}px Helvetica, Arial, sans-serif`;
    while (ctx.measureText(text).width > px(maxTextMm) && size > 1.9) {
      size -= 0.15;
      ctx.font = `400 ${px(size)}px Helvetica, Arial, sans-serif`;
    }
  };

  specLines.forEach((line, i) => {
    ctx.fillStyle = i === specLines.length - 1 && opts.note ? "#6B7280" : "#0A0A0B";
    fitText(line, 3.1);
    ctx.fillText(line, px(marginMm), px(fy + 11 + i * 4.6));
  });


  // 1:1 check square — 2 × 2 cm, verified with a ruler after printing
  const sq = 20;
  const sqX = marginMm + 106;
  const sqY = fy + 4;
  ctx.strokeStyle = "#0A0A0B";
  ctx.lineWidth = Math.max(1, px(0.3));
  ctx.strokeRect(px(sqX), px(sqY), px(sq), px(sq));
  ctx.fillStyle = "#0A0A0B";
  ctx.font = `700 ${px(3)}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("2 cm", px(sqX + sq / 2), px(sqY + sq / 2 + 1));
  ctx.fillStyle = "#6B7280";
  ctx.font = `400 ${px(2.6)}px Helvetica, Arial, sans-serif`;
  ctx.fillText("1:1 check", px(sqX + sq / 2), px(sqY + sq + 4));
  ctx.textAlign = "left";

  // Locked placement reference photo
  if (opts.photoUrl) {
    const boxW = 44;
    const boxH = 32;
    const boxX = paper.wMm - marginMm - boxW;
    const boxY = fy + 2;
    try {
      const photo = await loadImageEl(opts.photoUrl);
      const ratio = Math.min(
        boxW / photo.naturalWidth,
        boxH / photo.naturalHeight,
      );
      const pw = photo.naturalWidth * ratio;
      const ph = photo.naturalHeight * ratio;
      ctx.drawImage(
        photo,
        px(boxX + (boxW - pw) / 2),
        px(boxY + (boxH - ph) / 2),
        px(pw),
        px(ph),
      );
      ctx.strokeStyle = "#9CA3AF";
      ctx.lineWidth = Math.max(1, px(0.2));
      ctx.strokeRect(px(boxX), px(boxY), px(boxW), px(boxH));
      ctx.fillStyle = "#6B7280";
      ctx.font = `400 ${px(2.6)}px Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        "Locked AR placement",
        px(boxX + boxW / 2),
        px(boxY + boxH + 4),
      );
      ctx.textAlign = "left";
    } catch {
      /* reference photo is optional */
    }
  }


  return {
    canvas,
    widthCm: wCm,
    heightCm: hCm,
    paper: { wMm: paper.wMm, hMm: paper.hMm },
    orientation: landscape ? "landscape" : "portrait",
    fits,
  };
}


function fileBase(title?: string) {
  return (
    (title ?? "inksimulator").replace(/[^a-z0-9-_ ]/gi, "").trim() || "inksimulator"
  );
}

export async function downloadPrintSheetPng(opts: PrintSheetOptions) {
  const { canvas } = await renderPrintSheet(opts);
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(opts.title)}-print.png`;
  a.click();
}

export async function buildPrintSheetPdf(opts: PrintSheetOptions): Promise<{
  blob: Blob;
  fileName: string;
  widthCm: number;
  heightCm: number;
  orientation: "portrait" | "landscape";
  fits: boolean;
}> {
  const { canvas, paper, orientation, widthCm, heightCm, fits } =
    await renderPrintSheet(opts);
  const doc = new jsPDF({
    unit: "mm",
    format: [paper.wMm, paper.hMm],
    orientation,
  });
  doc.addImage(
    canvas.toDataURL("image/jpeg", 0.95),
    "JPEG",
    0,
    0,
    paper.wMm,
    paper.hMm,
  );
  return {
    blob: doc.output("blob"),
    fileName: `${fileBase(opts.title)}-print.pdf`,
    widthCm,
    heightCm,
    orientation,
    fits,
  };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadPrintSheetPdf(opts: PrintSheetOptions) {
  const { blob, fileName } = await buildPrintSheetPdf(opts);
  downloadBlob(blob, fileName);
  return fileName;
}

