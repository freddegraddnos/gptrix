/**
 * Fonts for text tattoos. All are free web fonts (Google Fonts) in
 * styles commonly used in tattooing — script, blackletter, stencil, etc.
 */

import { listCustomFonts } from "./paint/customFonts";

export type TattooFont = {
  id: string;
  /** CSS font-family */
  family: string;
  label: string;
  style: string;
  weight?: number;
  italic?: boolean;
  /** Installed by the user from the font catalogue. */
  custom?: boolean;
};

/**
 * Fonts installed from the built-in catalogue (shared with the drawing studio),
 * mapped into the shape the text tattoo tool uses.
 */
export function customTattooFonts(): TattooFont[] {
  return listCustomFonts().map((f) => ({
    id: f.id,
    family: `paint-custom-${f.id}`,
    label: f.label,
    style: "Installed",
    custom: true,
  }));
}

export const TATTOO_FONTS: TattooFont[] = [
  { id: "great-vibes", family: "Great Vibes", label: "Great Vibes", style: "Script" },
  { id: "tangerine", family: "Tangerine", label: "Tangerine", style: "Script", weight: 700 },
  { id: "pinyon", family: "Pinyon Script", label: "Pinyon", style: "Script" },
  { id: "sacramento", family: "Sacramento", label: "Sacramento", style: "Script" },
  { id: "dancing", family: "Dancing Script", label: "Dancing", style: "Script", weight: 700 },
  { id: "parisienne", family: "Parisienne", label: "Parisienne", style: "Script" },
  { id: "unifraktur", family: "UnifrakturMaguntia", label: "Maguntia", style: "Blackletter" },
  { id: "pirata", family: "Pirata One", label: "Pirata One", style: "Blackletter" },
  { id: "metal", family: "Metal Mania", label: "Metal Mania", style: "Metal" },
  { id: "rock-salt", family: "Rock Salt", label: "Rock Salt", style: "Handwriting" },
  { id: "homemade", family: "Homemade Apple", label: "Homemade", style: "Handwriting" },
  { id: "caveat", family: "Caveat", label: "Caveat", style: "Handwriting", weight: 700 },
  { id: "cinzel-dec", family: "Cinzel Decorative", label: "Cinzel Dec.", style: "Roman", weight: 700 },
  { id: "cinzel", family: "Cinzel", label: "Cinzel", style: "Roman", weight: 600 },
  { id: "playfair", family: "Playfair Display", label: "Playfair", style: "Serif", weight: 700 },
  { id: "bebas", family: "Bebas Neue", label: "Bebas", style: "Stencil" },
  { id: "special-elite", family: "Special Elite", label: "Typewriter", style: "Vintage" },
  { id: "amatic", family: "Amatic SC", label: "Amatic", style: "Condensed", weight: 700 },
];

/** <link>-URL som laddar alla typsnitten ovan. */
export const TATTOO_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Great+Vibes",
    "family=Tangerine:wght@400;700",
    "family=Pinyon+Script",
    "family=Sacramento",
    "family=Dancing+Script:wght@400;700",
    "family=Parisienne",
    "family=UnifrakturMaguntia",
    "family=Pirata+One",
    "family=Metal+Mania",
    "family=Rock+Salt",
    "family=Homemade+Apple",
    "family=Caveat:wght@400;700",
    "family=Cinzel+Decorative:wght@400;700",
    "family=Cinzel:wght@400;600",
    "family=Playfair+Display:ital,wght@0,400;0,700;1,700",
    "family=Bebas+Neue",
    "family=Special+Elite",
    "family=Amatic+SC:wght@400;700",
  ].join("&") +
  "&display=swap";

export type TextMotifOptions = {
  text: string;
  font: TattooFont;
  /** Extra letter spacing in px at render size */
  letterSpacing?: number;
  italic?: boolean;
  /** Bend the text along an arc, -60..60 degrees */
  curve?: number;
  /** Layout of the rendered lettering. */
  form?: TextForm;
};

export type TextForm = "horizontal" | "vertical" | "arc" | "circle";

export type TextMotifLayout = {
  width: number;
  height: number;
  radius: number;
};

const FONT_PX = 160;
const PAD = 40;

/** Pure layout helper used by rendering and deterministic tests. */
export function calculateTextMotifLayout(
  form: TextForm,
  textWidth: number,
  textHeight: number,
  glyphCount: number,
  curve = 0,
): TextMotifLayout {
  if (form === "vertical") {
    return {
      width: Math.ceil(textWidth + PAD * 2),
      height: Math.ceil(textHeight * Math.max(1, glyphCount) + PAD * 2),
      radius: 0,
    };
  }
  if (form === "circle") {
    const radius = Math.max(FONT_PX * 1.15, textWidth / (Math.PI * 2));
    const side = Math.ceil((radius + textHeight) * 2 + PAD * 2);
    return { width: side, height: side, radius };
  }
  const curveRad = form === "arc" ? (Math.abs(curve) * Math.PI) / 180 : 0;
  const bulge = curveRad ? (textWidth / 2) * Math.tan(curveRad / 2) : 0;
  return {
    width: Math.ceil(textWidth + PAD * 2),
    height: Math.ceil(textHeight + PAD * 2 + bulge),
    radius: 0,
  };
}

async function ensureFont(font: TattooFont, italic: boolean) {
  const spec = `${italic ? "italic " : ""}${font.weight ?? 400} ${FONT_PX}px "${font.family}"`;
  try {
    await document.fonts.load(spec, "AaBbGg");
    await document.fonts.ready;
  } catch {
    /* fallback to system font */
  }
  return spec;
}

/**
 * Renders the text to a transparent PNG (black text, no background) that can
 * be used directly as an AR motif.
 */
export async function renderTextMotif(
  opts: TextMotifOptions,
): Promise<string> {
  const italic = opts.italic ?? false;
  const spec = await ensureFont(opts.font, italic);
  const lines = opts.text.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return "";
  const spacing = opts.letterSpacing ?? 0;
  const form = opts.form ?? "horizontal";
  const curve = form === "arc" ? (opts.curve ?? 0) : 0;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return "";
  measure.font = spec;
  // Real glyph extents per line — decorative fonts routinely exceed
  // FONT_PX-based guesses, which clipped ascenders/descenders.
  const lineMetrics = lines.map((l) => {
    const m = measure.measureText(l);
    const ascent = m.actualBoundingBoxAscent || FONT_PX * 0.8;
    const descent = m.actualBoundingBoxDescent || FONT_PX * 0.25;
    return {
      width: m.width + spacing * Math.max(0, l.length - 1),
      ascent,
      descent,
    };
  });
  const lineGap = FONT_PX * 0.2;
  const textW = Math.max(...lineMetrics.map((m) => m.width), 1);
  const textH =
    lineMetrics.reduce((sum, m) => sum + m.ascent + m.descent, 0) +
    lineGap * (lines.length - 1);

  const glyphs = Array.from(opts.text.replace(/\n/g, ""));
  const widestGlyph = Math.max(
    1,
    ...glyphs.map((glyph) => measure.measureText(glyph).width),
  );
  const lineHeight = Math.max(
    FONT_PX,
    ...lineMetrics.map((metrics) => metrics.ascent + metrics.descent),
  );
  const circleWidth = glyphs.reduce(
    (sum, glyph) => sum + measure.measureText(glyph).width + spacing,
    0,
  );
  const layout = calculateTextMotifLayout(
    form,
    form === "circle" ? circleWidth : form === "vertical" ? widestGlyph : textW,
    form === "vertical" ? lineHeight : textH,
    glyphs.length,
    curve,
  );
  const curveRad = (Math.abs(curve) * Math.PI) / 180;
  const bulge = Math.max(0, layout.height - textH - PAD * 2);

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.font = spec;
  ctx.fillStyle = "#0a0a0a";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  if (form === "vertical") {
    let y = PAD + lineHeight * 0.82;
    for (const glyph of glyphs) {
      ctx.fillText(glyph, canvas.width / 2, y);
      y += lineHeight;
    }
    return canvas.toDataURL("image/png");
  }

  if (form === "circle") {
    const advances = glyphs.map(
      (glyph) => measure.measureText(glyph).width + spacing,
    );
    const totalAdvance = advances.reduce((sum, advance) => sum + advance, 0) || 1;
    const center = canvas.width / 2;
    let travelled = 0;
    glyphs.forEach((glyph, index) => {
      const advance = advances[index] ?? 0;
      const angle = -Math.PI / 2 + ((travelled + advance / 2) / totalAdvance) * Math.PI * 2;
      ctx.save();
      ctx.translate(
        center + Math.cos(angle) * layout.radius,
        center + Math.sin(angle) * layout.radius,
      );
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
      travelled += advance;
    });
    return canvas.toDataURL("image/png");
  }

  const drawLine = (line: string, y: number) => {
    if (!spacing && !curve) {
      ctx.fillText(line, canvas.width / 2, y);
      return;
    }
    const chars = Array.from(line);
    const total =
      measure.measureText(line).width + spacing * Math.max(0, chars.length - 1);
    let x = canvas.width / 2 - total / 2;
    for (const ch of chars) {
      const w = measure.measureText(ch).width;
      if (curve) {
        // Place the character along an arc
        const t = total ? (x + w / 2 - (canvas.width / 2 - total / 2)) / total : 0.5;
        const angle = (t - 0.5) * curveRad;
        const radius = total / (2 * Math.sin(curveRad / 2 || 1));
        const sign = curve > 0 ? 1 : -1;
        ctx.save();
        ctx.translate(
          canvas.width / 2 + Math.sin(angle) * radius,
          y + sign * (radius - Math.cos(angle) * radius),
        );
        ctx.rotate(sign * angle);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(ch, x + w / 2, y);
      }
      x += w + spacing;
    }
  };

  let cursorY = PAD + (curve < 0 ? bulge : 0);
  lines.forEach((line, i) => {
    const m = lineMetrics[i];
    cursorY += m.ascent;
    drawLine(line, cursorY);
    cursorY += m.descent + lineGap;
  });

  return canvas.toDataURL("image/png");
}
