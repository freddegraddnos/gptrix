import { TATTOOS, type Tattoo } from "@/lib/tattoos";

/** Curated built-in sketches per Swedish motif landing page. Pure selection, no data changes. */
const RULES: Record<string, (t: Tattoo) => boolean> = {
  "fineline-tatuering": (t) => t.style === "Fineline",
  "realistisk-tatuering": (t) => t.type === "Realistic",
  "djur-tatuering": (t) => t.type === "Animals" || (t.type === "Realistic" && /wolf|lion|tiger|bear|owl|eagle|stag/i.test(t.name)),
  "sma-tatueringar": (t) => t.widthCm <= 11 || t.style === "Minimal" || t.style === "Fineline",
  "tatuering-blommor": (t) => t.type === "Flowers" || /rose|lotus|bloom|flower|sakura|kiku|lavender|floral|wildflower/i.test(t.name),
  "tatuering-fjaril": (t) => /butterfly|moth/i.test(t.name),
  "tatuering-hjarta": (t) => /heart/i.test(t.name),
  "tatuering-kompass": (t) => /compass|north|anchor/i.test(t.name),
  "tatuering-fagel": (t) => /swallow|eagle|raven|owl|phoenix|hummingbird|bird|crane/i.test(t.name),
  "tatuering-stjarna": (t) => /star|crescent|moon|sun/i.test(t.name),
  "tatuering-orm": (t) => /snake|serpent|dragon|ryu/i.test(t.name),
  "tatuering-ros": (t) => /rose/i.test(t.name),
  "tatuering-varg": (t) => /wolf|bear|panther|lion|tiger/i.test(t.name),
  "japansk-tatuering": (t) => t.type === "Japanese",
};

export function motifGallery(slug: string, limit = 12): Tattoo[] {
  const rule = RULES[slug];
  if (!rule) return [];
  return TATTOOS.filter(rule).slice(0, limit);
}
