/** Recommended placement and coverage for gallery designs. Pure, tested. */
export const PLACEMENTS = [
  { id: "upperarm", label: "Upper arm" },
  { id: "forearm", label: "Forearm" },
  { id: "hand", label: "Hand" },
  { id: "neck", label: "Neck" },
  { id: "back", label: "Back" },
  { id: "chest", label: "Chest" },
  { id: "thigh", label: "Thigh" },
  { id: "calf", label: "Calf" },
  { id: "arm", label: "Arm (whole)" },
  { id: "leg", label: "Leg (whole)" },
] as const;
export type PlacementId = (typeof PLACEMENTS)[number]["id"];

export const COVERAGES = [
  { id: "single", label: "Single design" },
  { id: "half_sleeve", label: "Half sleeve" },
  { id: "full_sleeve", label: "Full sleeve" },
] as const;
export type CoverageId = (typeof COVERAGES)[number]["id"];

export const NO_PLACEMENT_LABEL = "No specific placement";

export const placementLabel = (id: string) => PLACEMENTS.find((p) => p.id === id)?.label ?? id;
export const coverageLabel = (id: string) => COVERAGES.find((c) => c.id === id)?.label ?? id;

/** A sleeve needs arm or leg when placements are chosen. Returns an error key or null. */
export function validatePlacement(placements: string[], coverage: string): string | null {
  if (!COVERAGES.some((c) => c.id === coverage)) return "Invalid coverage";
  if (coverage !== "single" && placements.length > 0 && !placements.some((p) => p === "arm" || p === "leg")) {
    return "A sleeve needs Arm or Leg as placement.";
  }
  return null;
}

/** Filter never locks: designs without a specific placement match every placement filter. */
export function matchesPlacementFilter(
  motif: { placements?: string[] | null; coverage?: string | null },
  placement: string | "All",
  coverage: string | "All",
): boolean {
  const list = motif.placements ?? [];
  if (placement !== "All" && list.length > 0 && !list.includes(placement)) return false;
  if (coverage !== "All" && (motif.coverage ?? "single") !== coverage) return false;
  return true;
}

/** Body-part ids the live try-on understands. */
const AR_PARTS: Record<string, string> = { forearm: "forearm", upperarm: "upperarm", calf: "calf", hand: "hand", arm: "forearm", leg: "calf" };
export const arBodyPart = (placement: string) => AR_PARTS[placement] ?? null;
