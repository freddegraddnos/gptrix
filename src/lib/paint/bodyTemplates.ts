/**
 * Body-part templates for the start screen.
 *
 * Each template pairs a real-world canvas size in millimetres with a line-art
 * outline of that body part. The outline is placed as the locked background
 * reference so the artist can draw the tattoo directly onto the shape at a
 * realistic scale, without scanning a photo first.
 *
 * Framework-agnostic: no React here. The image URLs are resolved by the
 * bundler through the asset imports below.
 */

import armUrl from "@/assets/templates/arm.png";
import legUrl from "@/assets/templates/leg.png";
import bodyUrl from "@/assets/templates/body.png";
import neckUrl from "@/assets/templates/neck.png";
import handUrl from "@/assets/templates/hand.png";
import sideUrl from "@/assets/templates/side.png";

export type BodyPart = "arm" | "leg" | "body" | "neck" | "hand" | "side";

export interface BodyTemplate {
  id: BodyPart;
  /** Label shown on the start screen. */
  label: string;
  /** Short hint about what the template covers. */
  hint: string;
  /** Canvas width in millimetres — an average adult measurement. */
  widthMm: number;
  /** Canvas height in millimetres. */
  heightMm: number;
  /** Line-art outline used as the locked background reference. */
  url: string;
}

export const BODY_TEMPLATES: BodyTemplate[] = [
  {
    id: "arm",
    label: "Arm",
    hint: "Forearm to hand",
    widthMm: 140,
    heightMm: 280,
    url: armUrl,
  },
  {
    id: "leg",
    label: "Leg",
    hint: "Thigh to foot",
    widthMm: 200,
    heightMm: 400,
    url: legUrl,
  },
  {
    id: "body",
    label: "Body",
    hint: "Torso, front or back",
    widthMm: 320,
    heightMm: 420,
    url: bodyUrl,
  },
  {
    id: "neck",
    label: "Neck",
    hint: "Throat and collarbone",
    widthMm: 160,
    heightMm: 160,
    url: neckUrl,
  },
  {
    id: "hand",
    label: "Hand",
    hint: "Back of the hand",
    widthMm: 110,
    heightMm: 140,
    url: handUrl,
  },
  {
    id: "side",
    label: "Side",
    hint: "Ribcage to waist",
    widthMm: 220,
    heightMm: 320,
    url: sideUrl,
  },
];

export function findBodyTemplate(id: BodyPart): BodyTemplate | undefined {
  return BODY_TEMPLATES.find((t) => t.id === id);
}

/** Loads a template outline, ready to hand to setBackgroundReference(). */
export async function loadBodyTemplateImage(template: BodyTemplate): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Could not load the ${template.label} template`));
    image.src = template.url;
  });
  const source = document.createElement("canvas");
  source.width = image.naturalWidth || image.width;
  source.height = image.naturalHeight || image.height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error(`Could not prepare the ${template.label} template`);
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
  let left = source.width;
  let top = source.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (pixels.data[(y * source.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return source;
  const output = document.createElement("canvas");
  output.width = right - left + 1;
  output.height = bottom - top + 1;
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error(`Could not prepare the ${template.label} template`);
  outputContext.drawImage(
    source,
    left,
    top,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height,
  );
  return output;
}
