/** Shared constants for sending one tattoo request to several artists. */
export const MULTI_REQUEST_KEY = "inkvision.multi-request.v1";
export const MAX_MULTI_ARTISTS = 5;

export function readSelectedHandles(): string[] {
  try {
    const raw = sessionStorage.getItem(MULTI_REQUEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && item.length >= 3)
      .slice(0, MAX_MULTI_ARTISTS);
  } catch {
    return [];
  }
}

export function clearSelectedHandles() {
  try {
    sessionStorage.removeItem(MULTI_REQUEST_KEY);
  } catch {
    /* ignore */
  }
}
