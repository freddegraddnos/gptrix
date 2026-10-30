import type { NavKey } from "./studioNav";

/** These choices control presentation, never authorization or existing records. */
export const STUDIO_MODULES = [
  "requests",
  "designs",
  "booking",
  "payments",
  "fortnox",
  "models",
] as const;
export type StudioModule = (typeof STUDIO_MODULES)[number];

// Until a studio makes an explicit choice, keep every existing tool available.
export const DEFAULT_STUDIO_MODULES: StudioModule[] = [...STUDIO_MODULES];

const navModules: Partial<Record<NavKey, StudioModule>> = {
  // Keep inbox, clients and bookings reachable for ongoing work.
  concepts: "requests",
  motiv: "designs",
  skisser: "designs",
  skapa: "designs",
  kalender: "booking",
  hours: "booking",
  sync: "booking",
  scans: "models",
};

export function normalizeStudioModules(value: unknown): StudioModule[] {
  if (!Array.isArray(value)) return [...DEFAULT_STUDIO_MODULES];
  return STUDIO_MODULES.filter((name) => value.includes(name));
}

export function studioNavVisible(key: NavKey, enabled: readonly StudioModule[]): boolean {
  const module = navModules[key];
  return !module || enabled.includes(module);
}
