export const STUDIO_WORK_WEEKS = 48;
export const STUDIO_TIME_STORAGE_KEY = "inksimulator.studio-time-value";

export type StudioTimeScenario = {
  minutes: string;
  clients: string;
  rate: string;
  stencil: boolean;
  stencilMinutes: string;
  fortnox: boolean;
  fortnoxMinutes: string;
  leads: boolean;
  leadsMinutes: string;
};
export type StudioTimeField = "minutes" | "clients" | "rate" | "stencilMinutes" | "fortnoxMinutes" | "leadsMinutes";
export const DEFAULT_STUDIO_TIME: StudioTimeScenario = {
  minutes: "15", clients: "5", rate: "800",
  stencil: false, stencilMinutes: "0",
  fortnox: false, fortnoxMinutes: "0",
  leads: false, leadsMinutes: "0",
};

export function parseStudioTimeNumber(value: string): number | null {
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null;
  const number = Number(value.trim().replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function calculateStudioTimeValue(scenario: StudioTimeScenario) {
  const active: StudioTimeField[] = ["minutes", "clients", "rate"];
  if (scenario.stencil) active.push("stencilMinutes");
  if (scenario.fortnox) active.push("fortnoxMinutes");
  if (scenario.leads) active.push("leadsMinutes");
  const errors = active.filter(field => parseStudioTimeNumber(scenario[field]) === null);
  const n = (field: StudioTimeField) => parseStudioTimeNumber(scenario[field]) ?? 0;
  const base = n("clients") * n("minutes") * STUDIO_WORK_WEEKS / 60;
  const stencil = scenario.stencil ? n("clients") * n("stencilMinutes") * STUDIO_WORK_WEEKS / 60 : 0;
  const fortnox = scenario.fortnox ? n("fortnoxMinutes") * 12 / 60 : 0;
  const leads = scenario.leads ? n("leadsMinutes") * 12 / 60 : 0;
  const hours = base + stencil + fortnox + leads;
  const value = hours * n("rate");
  return { base, stencil, fortnox, leads, hours, value, errors, valid: errors.length === 0 && Number.isFinite(value) };
}

export function restoreStudioTimeScenario(raw: string | null): StudioTimeScenario {
  const restored = { ...DEFAULT_STUDIO_TIME };
  if (!raw) return restored;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return restored;
    const values = saved as Record<string, unknown>;
    for (const field of ["minutes", "clients", "rate", "stencilMinutes", "fortnoxMinutes", "leadsMinutes"] as const) {
      const value = values[field];
      if (typeof value === "string") restored[field] = value;
    }
    for (const field of ["stencil", "fortnox", "leads"] as const) {
      const value = values[field];
      if (typeof value === "boolean") restored[field] = value;
    }
  } catch { /* A damaged session starts with the approved defaults. */ }
  return restored;
}