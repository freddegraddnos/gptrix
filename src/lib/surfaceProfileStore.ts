/**
 * Persists the last accepted Surface Scan so a returning session lands with
 * the design already lying correctly on the body part.
 * Local-only, keyed by profile id when the user is signed in.
 */
import type { SurfaceProfile } from "@/lib/surfaceProfile";

const KEY = "inkvision.ar.surfaceProfile";

function storageKey(profileId?: string | null) {
  return profileId ? `${KEY}.${profileId}` : KEY;
}

export function loadSurfaceProfile(
  profileId?: string | null,
): SurfaceProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurfaceProfile;
    if (typeof parsed?.curve !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSurfaceProfile(
  profile: SurfaceProfile,
  profileId?: string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(profileId), JSON.stringify(profile));
  } catch {
    /* storage blocked — the in-memory profile still applies this session */
  }
}

export function clearSurfaceProfile(profileId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(profileId));
  } catch {
    /* nothing to do */
  }
}
