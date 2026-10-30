/**
 * Sanity-checks that an uploaded SVG really is a 1:1 millimetre drawing, so a
 * stencil that was exported in pixels or at the wrong scale is caught before
 * it reaches the tattoo machine.
 */

export type SvgScaleCheck = {
  ok: boolean;
  /** Declared width/height in millimetres, when they could be resolved. */
  widthMm: number | null;
  heightMm: number | null;
  /** Human-readable problems, worst first. */
  problems: string[];
  hint: string;
};

const UNIT_TO_MM: Record<string, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  pt: 25.4 / 72,
  pc: 25.4 / 6,
  px: 25.4 / 96,
  "": 25.4 / 96,
};

function toMm(raw: string | null): { mm: number | null; unit: string } {
  if (!raw) return { mm: null, unit: "" };
  const m = raw.trim().match(/^([\d.]+)\s*(mm|cm|in|pt|pc|px|%)?$/i);
  if (!m) return { mm: null, unit: "" };
  const unit = (m[2] ?? "").toLowerCase();
  if (unit === "%") return { mm: null, unit };
  const factor = UNIT_TO_MM[unit];
  if (factor === undefined) return { mm: null, unit };
  return { mm: Number(m[1]) * factor, unit };
}

/**
 * @param svgText raw SVG markup
 * @param expectedMm the width the booking asked for, when known
 */
export function checkSvgScale(svgText: string, expectedMm?: number | null): SvgScaleCheck {
  const problems: string[] = [];
  const head = svgText.slice(0, 4000);
  const attr = (name: string) => {
    const m = head.match(new RegExp(`<svg[^>]*\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"));
    return m ? m[1] : null;
  };

  const w = toMm(attr("width"));
  const h = toMm(attr("height"));
  const viewBox = attr("viewBox");

  if (w.mm === null) {
    problems.push("The SVG has no usable width — it cannot be printed at a known size.");
  } else if (w.unit !== "mm" && w.unit !== "cm" && w.unit !== "in") {
    problems.push(
      `The width is set in ${w.unit || "pixels"}, not physical units. Export with millimetres for a true 1:1 file.`,
    );
  }

  if (w.mm !== null && (w.mm < 5 || w.mm > 600)) {
    problems.push(
      `Declared width is ${w.mm.toFixed(1)} mm, which is outside a realistic tattoo size (5–600 mm).`,
    );
  }

  if (viewBox && w.mm !== null && h.mm !== null) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      const boxRatio = parts[2] / parts[3];
      const sizeRatio = w.mm / h.mm;
      if (Math.abs(boxRatio - sizeRatio) / sizeRatio > 0.02) {
        problems.push("The viewBox aspect ratio does not match the declared size — the artwork will be stretched.");
      }
    }
  }

  if (expectedMm && w.mm !== null) {
    const diff = Math.abs(w.mm - expectedMm) / expectedMm;
    if (diff > 0.02) {
      problems.push(
        `Expected ${Math.round(expectedMm)} mm wide but the file says ${w.mm.toFixed(1)} mm (${Math.round(diff * 100)}% off).`,
      );
    }
  }

  return {
    ok: problems.length === 0,
    widthMm: w.mm,
    heightMm: h.mm,
    problems,
    hint:
      w.mm !== null && h.mm !== null
        ? `${w.mm.toFixed(1)} × ${h.mm.toFixed(1)} mm`
        : "Size could not be read",
  };
}

/** Reads a picked SVG file and validates its 1:1 millimetre scale. */
export async function checkSvgFile(file: File, expectedMm?: number | null) {
  const text = await file.text();
  return checkSvgScale(text, expectedMm);
}
