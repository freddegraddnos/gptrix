export type BuilderPackage = "portfolio" | "studio" | "personal";
export type BuilderBlock = "works" | "artists" | "about" | "prices" | "faq" | "contact" | "booking";
export type BuilderPage = { id: string; kind: "page" | "external"; title: string; text: string; url: string };
export type BuilderContent = { name: string; city: string; address: string; website: string; bio: string; services: string; faq: string; blocks: BuilderBlock[]; hidden: BuilderBlock[]; selectedWorks: string[]; pages: BuilderPage[] };

// Read-only snapshot of approved public fields; missing information is not fabricated.
export const initialBuilderContent: BuilderContent = {
  name: "Lilla Gatans Tatuering", city: "Solna", address: "Lilla gatan 1A", website: "lillagatan.se",
  bio: "", services: "", faq: "", blocks: ["works", "about", "artists", "prices", "faq", "contact", "booking"],
  hidden: [], selectedWorks: ["flower", "butterfly", "raven"], pages: [],
};

export const blockNames: Record<BuilderBlock, string> = { works: "Arbetsprover", artists: "Artister", about: "Om studion", prices: "Tjänster/priser", faq: "FAQ", contact: "Kontakt", booking: "Bokning" };
export const packages: { id: BuilderPackage; title: string; description: string; mapping: string }[] = [
  { id: "portfolio", title: "Portfolio", description: "Arbetena i centrum", mapping: "gallery" },
  { id: "studio", title: "Studio", description: "Platsen och arbetssättet", mapping: "about" },
  { id: "personal", title: "Personligt", description: "En kompakt presentation", mapping: "compact" },
];
// Package is visual state only. Never mutate or replace the content on package change.
export function changePackage(content: BuilderContent, next: BuilderPackage) { return { content, package: next }; }
export function moveBlock(blocks: BuilderBlock[], id: BuilderBlock, delta: number) {
  const from = blocks.indexOf(id); const to = from + delta;
  if (from < 0 || to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks]; const item = next[from]; const target = next[to];
  if (!item || !target) return blocks;
  next[from] = target; next[to] = item; return next;
}
export function remainingTasks(c: BuilderContent) {
  return {
    necessary: [...(!c.name.trim() ? ["Ange studions namn"] : []), ...(!c.city.trim() || !c.address.trim() ? ["Ange plats och adress"] : []), ...(!c.website.trim() ? ["Ange en kontaktväg"] : [])],
    recommended: [...(!c.bio.trim() ? ["Skriv en kort presentation"] : []), ...(!c.services.trim() ? ["Beskriv tjänster och prisinformation"] : []), ...(!c.faq.trim() ? ["Besvara vanliga frågor"] : []), ...(!c.selectedWorks.length ? ["Välj arbetsprover"] : [])],
  };
}