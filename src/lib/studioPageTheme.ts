/** Visitor-facing look of a studio page (inksimulator.com/<handle>). Scoped to that page only. */
export type StudioPageTheme = {
  layout?: "gallery" | "about" | "compact";
  package?: "portfolio" | "studio" | "personal";
  bg?: "dark" | "light" | "image";
  bg_image?: string | null; // storage path in "studio" bucket
  cover?: string | null; // storage path
  accent?: string; // #rrggbb
  font?: string; // key in FONTS, or "custom"
  font_file?: string | null; // storage path of an uploaded font
  intro?: string; // studio's own text block
  pages?: StudioExtraPage[]; // custom buttons → own page, link or category gallery
  cover_position_desktop?: "top" | "center" | "bottom";
  cover_position_mobile?: "top" | "center" | "bottom";
  /** Optional explicit order/visibility. Missing = order from layout. The booking block is always shown. */
  sections?: StudioSectionSetting[];
};

export type StudioSectionKey = "about" | "gallery" | "services" | "cta";
export type StudioSectionSetting = { key: StudioSectionKey; hidden?: boolean };

export function defaultSectionOrder(layout: StudioPageTheme["layout"]): StudioSectionKey[] {
  return layout === "gallery" ? ["gallery", "about", "cta", "services"] : layout === "compact" ? ["about", "gallery", "cta", "services"] : ["about", "gallery", "services", "cta"];
}

/** Resolved order with every section present exactly once; booking (cta) can never be hidden. */
export function resolveSections(t: StudioPageTheme): StudioSectionSetting[] {
  const base = defaultSectionOrder(t.layout ?? "about");
  const saved = (t.sections ?? []).filter((x, i, all) => base.includes(x.key) && all.findIndex((y) => y.key === x.key) === i);
  const merged = [...saved, ...base.filter((k) => !saved.some((x) => x.key === k)).map((key) => ({ key }))];
  return merged.map((x) => (x.key === "cta" ? { key: "cta" } : x));
}

export type StudioExtraPage = { id: string; title: string; text?: string; url?: string; images?: string[] };

export const FONTS: { key: string; label: string; family: string; google?: string }[] = [
  { key: "default", label: "InkSimulator (Anton)", family: "Anton" },
  { key: "unifraktur", label: "Blackletter (UnifrakturMaguntia)", family: "UnifrakturMaguntia", google: "UnifrakturMaguntia" },
  { key: "pirata", label: "Old English (Pirata One)", family: "Pirata One", google: "Pirata+One" },
  { key: "bebas", label: "Bold sans (Bebas Neue)", family: "Bebas Neue", google: "Bebas+Neue" },
  { key: "playfair", label: "Elegant serif (Playfair Display)", family: "Playfair Display", google: "Playfair+Display:wght@700" },
  { key: "permanent", label: "Marker (Permanent Marker)", family: "Permanent Marker", google: "Permanent+Marker" },
  { key: "monoton", label: "Neon (Monoton)", family: "Monoton", google: "Monoton" },
  { key: "greatvibes", label: "Script (Great Vibes)", family: "Great Vibes", google: "Great+Vibes" },
  { key: "custom", label: "Own font file (.ttf / .otf / .woff)", family: "StudioCustomFont" },
];

const hex = (c: string) => /^#[0-9a-f]{6}$/i.test(c) ? c : "#8a5bf2";
function lum(c: string) {
  const n = parseInt(hex(c).slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Resolved colours. Image backgrounds get a dark overlay, so they behave like "dark". */
export function themeColors(t: StudioPageTheme) {
  const light = t.bg === "light";
  const bg = light ? "#f6f2ea" : "#0b0b0d";
  const fg = light ? "#161616" : "#f6f2ea";
  let accent = hex(t.accent ?? "#8a5bf2");
  const accentOk = contrast(accent, bg) >= 3;
  if (!accentOk) accent = light ? "#5b2fc9" : "#b896ff";
  // Text placed on accent buttons: whichever of ink/paper reads better.
  const onAccent = contrast(accent, "#161616") >= contrast(accent, "#ffffff") ? "#161616" : "#ffffff";
  return { bg, fg, accent, onAccent, accentAdjusted: !accentOk };
}

export function fontFor(t: StudioPageTheme) {
  return FONTS.find((f) => f.key === (t.font ?? "default")) ?? FONTS[0];
}

export function googleFontHref(t: StudioPageTheme) {
  const f = fontFor(t);
  return f.google ? `https://fonts.googleapis.com/css2?family=${f.google}&display=swap` : null;
}
