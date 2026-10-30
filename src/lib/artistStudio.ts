/**
 * Artist mode: design data and image composition for client projects.
 * Reuses the same canvas technique as photo try-on and the before/after video.
 */

export type DesignState = {
  /** 0-1 relative to the photo's width/height */
  x: number;
  y: number;
  /** the motif's width as a share of the photo's width */
  scale: number;
  /** degrees */
  rotation: number;
  opacity: number;
  /** hex color the motif is tinted to, or null for original */
  tint: string | null;
};

export const DEFAULT_DESIGN: DesignState = {
  x: 0.5,
  y: 0.5,
  scale: 0.35,
  rotation: 0,
  opacity: 0.92,
  tint: null,
};

export const INK_COLORS: { label: string; value: string | null }[] = [
  { label: "Original", value: null },
  { label: "Black", value: "#0b0b0b" },
  { label: "Blackgrey", value: "#3f3f46" },
  { label: "Red", value: "#b91c1c" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Green", value: "#15803d" },
];

export function parseDesign(raw: unknown): DesignState {
  const d = (raw ?? {}) as Partial<DesignState>;
  return {
    x: typeof d.x === "number" ? d.x : DEFAULT_DESIGN.x,
    y: typeof d.y === "number" ? d.y : DEFAULT_DESIGN.y,
    scale: typeof d.scale === "number" ? d.scale : DEFAULT_DESIGN.scale,
    rotation: typeof d.rotation === "number" ? d.rotation : DEFAULT_DESIGN.rotation,
    opacity: typeof d.opacity === "number" ? d.opacity : DEFAULT_DESIGN.opacity,
    tint: typeof d.tint === "string" ? d.tint : null,
  };
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

function tinted(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

const MAX_W = 1400;

/** Renders the client's photo with the motif placed according to the design. */
export async function composeAfterImage(
  basePhotoUrl: string,
  motifUrl: string,
  design: DesignState,
): Promise<string> {
  const [base, motif] = await Promise.all([
    loadImage(basePhotoUrl),
    loadImage(motifUrl),
  ]);
  const scaleDown = Math.min(1, MAX_W / base.width);
  const W = Math.round(base.width * scaleDown);
  const H = Math.round(base.height * scaleDown);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(base, 0, 0, W, H);

  const source = design.tint ? tinted(motif, design.tint) : motif;
  const mw = W * design.scale;
  const mh = (motif.height / motif.width) * mw;

  ctx.save();
  ctx.globalAlpha = design.opacity;
  ctx.translate(design.x * W, design.y * H);
  ctx.rotate((design.rotation * Math.PI) / 180);
  ctx.drawImage(source, -mw / 2, -mh / 2, mw, mh);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

/** Rescales the client's original photo to the same width as the "after" image. */
export async function composeBeforeImage(basePhotoUrl: string): Promise<string> {
  const base = await loadImage(basePhotoUrl);
  const scaleDown = Math.min(1, MAX_W / base.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(base.width * scaleDown);
  canvas.height = Math.round(base.height * scaleDown);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function previewLink(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://www.inksimulator.com";
  return `${origin}/p/${token}`;
}

export function inviteLink(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://www.inksimulator.com";
  return `${origin}/invite/${token}`;
}
