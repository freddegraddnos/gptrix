/**
 * Remembers the last accepted scan calibration per body part, so a returning
 * session can reuse the exact same size instead of re-measuring.
 * Stored locally and keyed by profile id when the user is signed in.
 */
export type StoredCalibration = {
  scaleFactor: number;
  bodyPart: string | null;
  /** ISO timestamp of when the calibration was accepted. */
  savedAt: string;
  source: "card" | "manual";
};

const KEY = "inkvision.scan.calibration";

function storageKey(profileId?: string | null) {
  return profileId ? `${KEY}.${profileId}` : KEY;
}

export function loadCalibration(
  profileId?: string | null,
  bodyPart?: string | null,
): StoredCalibration | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCalibration;
    if (typeof parsed?.scaleFactor !== "number" || !(parsed.scaleFactor > 0)) return null;
    if (bodyPart && parsed.bodyPart && parsed.bodyPart !== bodyPart) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCalibration(
  value: Omit<StoredCalibration, "savedAt">,
  profileId?: string | null,
): StoredCalibration | null {
  if (typeof window === "undefined") return null;
  const entry: StoredCalibration = { ...value, savedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(storageKey(profileId), JSON.stringify(entry));
  } catch {
    /* storage full or blocked – the in-memory value still applies */
  }
  return entry;
}

/** "Senast kalibrerad"-friendly label, e.g. "30 Aug 2026, 14:05". */
export function formatCalibratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
