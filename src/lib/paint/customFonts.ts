/**
 * Custom fonts the artist downloads themselves (e.g. from dafont.com) and
 * loads into the text tool.
 *
 * dafont.com serves fonts as .zip archives that cannot be fetched from the
 * browser (no CORS, and the file is an archive), so the flow is: the artist
 * downloads and unzips the font, then picks the .ttf/.otf/.woff file here. The
 * file is registered with the FontFace API so canvas rendering, export and
 * print all use the real face, and it is cached as a data URL so the font
 * survives reloads.
 *
 * No React here; pure TypeScript + browser font APIs.
 */

import type { TextFont } from "./text";

export interface CustomFont extends TextFont {
  custom: true;
  /** base64 data URL of the font file, used to re-register after a reload. */
  dataUrl: string;
}

const STORE_KEY = "paint.customFonts.v1";
/** Fonts are cached in localStorage; keep a sane ceiling per file. */
export const MAX_FONT_BYTES = 3 * 1024 * 1024;

const ALLOWED = /\.(ttf|otf|woff2?)$/i;

let fonts: CustomFont[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeCustomFonts(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function listCustomFonts(): CustomFont[] {
  return fonts;
}

export function customFontById(id: string): CustomFont | undefined {
  return fonts.find((f) => f.id === id);
}

function familyOf(id: string): string {
  return `paint-custom-${id}`;
}

function readStore(): CustomFont[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomFont[];
    return Array.isArray(parsed) ? parsed.filter((f) => f?.id && f?.dataUrl) : [];
  } catch {
    return [];
  }
}

function writeStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(fonts));
  } catch {
    // Quota exceeded: the font still works this session, it just isn't cached.
  }
}

async function register(font: CustomFont): Promise<boolean> {
  const set = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!set) return false;
  try {
    const face = new FontFace(familyOf(font.id), `url(${font.dataUrl})`);
    await face.load();
    set.add(face);
    return true;
  } catch {
    return false;
  }
}

/** Re-registers every cached font. Call once at startup, before first render. */
export async function loadStoredCustomFonts(): Promise<void> {
  if (typeof document === "undefined") return;
  const stored = readStore();
  if (stored.length === 0) return;
  const ok: CustomFont[] = [];
  for (const font of stored) {
    if (await register(font)) ok.push(font);
  }
  fonts = ok;
  if (ok.length !== stored.length) writeStore();
  emit();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function uniqueId(base: string): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "font";
  let id = slug;
  let n = 2;
  while (fonts.some((f) => f.id === id)) id = `${slug}-${n++}`;
  return id;
}

/**
 * Adds a font file picked by the artist. Returns the new font, or throws with a
 * message meant to be shown in the UI.
 */
export async function addCustomFontFile(file: File): Promise<CustomFont> {
  if (!ALLOWED.test(file.name)) {
    throw new Error("Choose a .ttf, .otf or .woff file (unzip the file from dafont first).");
  }
  if (file.size > MAX_FONT_BYTES) {
    throw new Error("File is too large (max 3 MB).");
  }
  const label = file.name.replace(ALLOWED, "").replace(/[_-]+/g, " ").trim() || "Font";
  const id = uniqueId(label);
  const dataUrl = await fileToDataUrl(file);
  const font: CustomFont = {
    id,
    label,
    stack: `"${familyOf(id)}", sans-serif`,
    lineHeight: 1.24,
    custom: true,
    dataUrl,
  };
  if (!(await register(font))) {
    throw new Error("The font could not be loaded. Try another file.");
  }
  fonts = [...fonts, font];
  writeStore();
  emit();
  return font;
}

/**
 * Adds a font fetched from the built-in catalogue (already unzipped server
 * side). `mime` follows the file extension so the FontFace loader is happy.
 */
export async function addCustomFontData(
  label: string,
  fileName: string,
  base64: string,
): Promise<CustomFont> {
  const ext = /\.otf$/i.test(fileName) ? "font/otf" : "font/ttf";
  const cleanLabel = label.trim() || fileName.replace(ALLOWED, "");
  const existing = fonts.find((f) => f.label === cleanLabel);
  if (existing) return existing;
  const id = uniqueId(cleanLabel);
  const font: CustomFont = {
    id,
    label: cleanLabel,
    stack: `"${familyOf(id)}", sans-serif`,
    lineHeight: 1.24,
    custom: true,
    dataUrl: `data:${ext};base64,${base64}`,
  };
  if (!(await register(font))) {
    throw new Error("The font could not be loaded.");
  }
  fonts = [...fonts, font];
  writeStore();
  emit();
  return font;
}

export function removeCustomFont(id: string) {
  fonts = fonts.filter((f) => f.id !== id);
  writeStore();
  emit();
}
