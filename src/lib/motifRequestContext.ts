/** Optional creator context around try-on. No camera state, image URLs or rights are stored here. */
export type MotifRequestContext = { motifId: string; studioId: string; handle: string };
const KEY = "inkvision.motif-request-context.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validMotifContext(value: unknown): value is MotifRequestContext {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<MotifRequestContext>;
  return (
    typeof v.motifId === "string" &&
    UUID.test(v.motifId) &&
    typeof v.studioId === "string" &&
    UUID.test(v.studioId) &&
    typeof v.handle === "string" &&
    /^[a-z0-9_-]{3,40}$/i.test(v.handle)
  );
}
export function setMotifRequestContext(value: MotifRequestContext) {
  if (!validMotifContext(value)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* Explicit contact link still works. */
  }
}
export function getMotifRequestContext(motifId?: string): MotifRequestContext | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return validMotifContext(value) && (!motifId || value.motifId === motifId) ? value : null;
  } catch {
    return null;
  }
}
export function clearMotifRequestContext() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Storage may be unavailable. */
  }
}
export function motifRequestPath(context: MotifRequestContext): string {
  return `/${encodeURIComponent(context.handle)}/book?motif=${encodeURIComponent(context.motifId)}`;
}
