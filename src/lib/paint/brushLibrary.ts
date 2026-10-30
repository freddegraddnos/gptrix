/**
 * Brush library: named brush presets, stored in the browser.
 *
 * A preset is just the settings that make a brush feel a certain way — shape,
 * size, opacity and the whole feel block. Saving is therefore cheap and the
 * engine never has to know presets exist.
 */

import { DEFAULT_FEEL, type FeelSettings } from "./feel";
import type { BrushId } from "./types";

export interface BrushPreset {
  id: string;
  name: string;
  brushId: BrushId;
  /** Document pixels. */
  size: number;
  /** 0..1 */
  opacity: number;
  feel: FeelSettings;
}

/**
 * Ready-made presets that ship with the app. They are read-only: applying one
 * just loads its settings, and "duplicate" copies it into the user's own list
 * where it behaves exactly like a hand-saved preset.
 */
export const BUILTIN_PRESETS: BrushPreset[] = [
  {
    id: "builtin.fineline",
    name: "Fine Line",
    brushId: "fineline",
    size: 3,
    opacity: 1,
    feel: { ...DEFAULT_FEEL, curve: "hard", streamline: 0.55, taper: 0.35, opacityFromPressure: false },
  },
  {
    id: "builtin.dotwork",
    name: "Dotwork",
    brushId: "dotwork",
    size: 26,
    opacity: 0.95,
    feel: { ...DEFAULT_FEEL, curve: "normal", streamline: 0.3, taper: 0, sizeFromPressure: false },
  },
  {
    id: "builtin.blackwork",
    name: "Blackwork",
    brushId: "blackwork",
    size: 60,
    opacity: 1,
    feel: { ...DEFAULT_FEEL, curve: "soft", streamline: 0.4, taper: 0.1, opacityFromPressure: false },
  },
  {
    id: "builtin.watercolor",
    name: "Watercolor",
    brushId: "watercolor",
    size: 90,
    opacity: 0.55,
    feel: { ...DEFAULT_FEEL, curve: "soft", streamline: 0.45, taper: 0.6 },
  },
];

const KEY = "paint.brushPresets.v1";

let cache: BrushPreset[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeBrushPresets(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(): BrushPreset[] {
  if (cache) return cache;
  if (typeof localStorage === "undefined") return (cache = []);
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as BrushPreset[]) : [];
    cache = Array.isArray(parsed)
      ? parsed.filter((p) => p && typeof p.name === "string").map((p) => ({
          ...p,
          feel: { ...DEFAULT_FEEL, ...p.feel },
        }))
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: BrushPreset[]) {
  cache = next;
  try {
    localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota: the presets stay in memory for this session.
  }
  emit();
}

export function listBrushPresets(): BrushPreset[] {
  return read();
}

export function saveBrushPreset(preset: Omit<BrushPreset, "id">): BrushPreset {
  const created: BrushPreset = { ...preset, id: `bp${Date.now()}${Math.random().toString(36).slice(2, 6)}` };
  write([...read(), created]);
  return created;
}

/** Duplicates a preset, appending a copy marker to the name. */
export function duplicateBrushPreset(id: string): BrushPreset | null {
  const source = read().find((p) => p.id === id) ?? BUILTIN_PRESETS.find((p) => p.id === id);
  if (!source) return null;
  return saveBrushPreset({ ...source, name: `${source.name} kopia` });
}

export function renameBrushPreset(id: string, name: string) {
  write(read().map((p) => (p.id === id ? { ...p, name } : p)));
}

export function removeBrushPreset(id: string) {
  write(read().filter((p) => p.id !== id));
}
