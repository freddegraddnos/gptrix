/**
 * Tattoo Journey: step types and "AI → REAL" collage.
 * The collage is drawn with the same canvas technique as the Before/After video.
 */

export type JourneyKind = "idea" | "final_design" | "real";

export const JOURNEY_KINDS: {
  value: JourneyKind;
  label: string;
  hint: string;
}[] = [
  { value: "idea", label: "Idea", hint: "Sketches, AR tests and AI designs" },
  { value: "final_design", label: "Final design", hint: "The design you booked" },
  { value: "real", label: "Real tattoo", hint: "Photo of the finished tattoo" },
];

export function kindLabel(kind: string): string {
  return JOURNEY_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export type JourneyStep = {
  id: string;
  kind: string;
  title: string | null;
  note: string | null;
  image_url: string;
  created_at: string;
};

/** Sorts the steps in timeline order: ideas first, then final, then real. */
export function sortJourney<T extends { kind: string; created_at: string }>(
  steps: T[],
): T[] {
  const rank = (k: string) =>
    k === "idea" ? 0 : k === "final_design" ? 1 : k === "real" ? 2 : 3;
  return [...steps].sort(
    (a, b) =>
      rank(a.kind) - rank(b.kind) ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/** Label for a step, e.g. "Idea #2" or "Final Design". */
export function stepLabel(steps: JourneyStep[], index: number): string {
  const s = steps[index];
  if (s.kind === "final_design") return "Final Design";
  if (s.kind === "real") return "Actual Tattoo";
  const nth = steps.slice(0, index + 1).filter((x) => x.kind === "idea").length;
  return `Idea #${nth}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function spaced(s: string) {
  return s.split("").join("\u2009");
}

/**
 * Builds a shareable "AI → REAL" collage (1080x1350) of the design and the
 * real result. Returns a PNG data URL.
 */
export async function composeAiToRealCollage(input: {
  designUrl: string;
  realUrl: string;
  title?: string;
}): Promise<string> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

  const [design, real] = await Promise.all([
    loadImage(input.designUrl),
    loadImage(input.realUrl),
  ]);

  const top = 150;
  const paneH = 900;
  const gap = 8;
  const paneW = (W - gap) / 2;

  drawCover(ctx, design, 0, top, paneW, paneH);
  drawCover(ctx, real, paneW + gap, top, paneW, paneH);

  // Heading
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 62px "Space Grotesk", "Inter", sans-serif';
  ctx.fillText(input.title?.slice(0, 26) || "AI → REAL", W / 2, 96);

  // Panel labels
  const badge = (label: string, cx: number) => {
    ctx.font = '700 30px "Inter", sans-serif';
    const text = spaced(label);
    const w = ctx.measureText(text).width + 44;
    const y = top + paneH - 70;
    ctx.fillStyle = "rgba(5,5,5,0.75)";
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y, w, 56, 28);
    ctx.fill();
    ctx.fillStyle = "#8A5BF2";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, y + 29);
    ctx.textBaseline = "alphabetic";
  };
  badge("AI DESIGN", paneW / 2);
  badge("REAL TATTOO", paneW + gap + paneW / 2);

  // Arrow in the middle
  ctx.fillStyle = "#050505";
  ctx.beginPath();
  ctx.arc(W / 2, top + paneH / 2, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8A5BF2";
  ctx.font = '700 54px "Inter", sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("→", W / 2, top + paneH / 2 + 4);
  ctx.textBaseline = "alphabetic";

  // Footer
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 40px "Space Grotesk", "Inter", sans-serif';
  ctx.fillText("From idea to ink", W / 2, top + paneH + 100);
  ctx.fillStyle = "#8A5BF2";
  ctx.font = '700 26px "Inter", sans-serif';
  ctx.fillText(
    spaced("CREATED WITH INKSIMULATOR"),
    W / 2,
    top + paneH + 156,
  );

  return canvas.toDataURL("image/png");
}
