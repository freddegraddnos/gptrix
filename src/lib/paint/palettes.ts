/**
 * Colour history and saved palettes.
 *
 * The history is the last colours actually painted with, newest first; palettes
 * are named sets the artist curates (skin tones, grey wash values, a client's
 * colour scheme). Both live in localStorage so they survive a reload.
 */

import { rgbToHex } from "./color";
import type { RGB } from "./types";

export interface Palette {
  id: string;
  name: string;
  colors: RGB[];
}

const HISTORY_KEY = "paint.colorHistory.v1";
const PALETTE_KEY = "paint.palettes.v1";
const HISTORY_LIMIT = 30;

const listeners = new Set<() => void>();

export function subscribePalettes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const l of listeners) l();
}

function load<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal: colours simply won't persist in this browser.
  }
  emit();
}

export function loadColorHistory(): RGB[] {
  const list = load<RGB[]>(HISTORY_KEY, []);
  return Array.isArray(list) ? list.filter((c) => c && typeof c.r === "number") : [];
}

/** Puts `color` first, de-duplicated by hex, and trims the tail. */
export function pushColorHistory(color: RGB): RGB[] {
  const hex = rgbToHex(color);
  const next = [color, ...loadColorHistory().filter((c) => rgbToHex(c) !== hex)].slice(
    0,
    HISTORY_LIMIT,
  );
  save(HISTORY_KEY, next);
  return next;
}

export function clearColorHistory(): RGB[] {
  save(HISTORY_KEY, []);
  return [];
}

export function listPalettes(): Palette[] {
  const list = load<Palette[]>(PALETTE_KEY, []);
  return Array.isArray(list) ? list.filter((p) => p && Array.isArray(p.colors)) : [];
}

export function createPalette(name: string, colors: RGB[] = []): Palette {
  const palette: Palette = {
    id: `pal${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "Palett",
    colors,
  };
  save(PALETTE_KEY, [...listPalettes(), palette]);
  return palette;
}

export function addColorToPalette(id: string, color: RGB) {
  const hex = rgbToHex(color);
  save(
    PALETTE_KEY,
    listPalettes().map((p) =>
      p.id === id && !p.colors.some((c) => rgbToHex(c) === hex)
        ? { ...p, colors: [...p.colors, color] }
        : p,
    ),
  );
}

export function removeColorFromPalette(id: string, index: number) {
  save(
    PALETTE_KEY,
    listPalettes().map((p) =>
      p.id === id ? { ...p, colors: p.colors.filter((_, i) => i !== index) } : p,
    ),
  );
}

export function removePalette(id: string) {
  save(PALETTE_KEY, listPalettes().filter((p) => p.id !== id));
}
