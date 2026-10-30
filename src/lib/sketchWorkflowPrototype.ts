/** Review-only state: no cloud clients, engine imports or messaging. */
export type SketchDraft = { title: string; tags: string; bodyPart: string; strokes: string[] };
export type SketchSnapshot = { id: string; number: number; date: string; content: SketchDraft };
export type SketchDocument = { id: string; studioId: string; requestId: string | null; customer: string | null; draft: SketchDraft; versions: SketchSnapshot[]; sharedIds: string[] };
export type DemoState = { documents: SketchDocument[]; sync: "dirty" | "local" | "failed" | "syncing" | "saved"; messages: number };
export const initialSketchDemo: DemoState = { sync: "saved", messages: 0, documents: [
  { id: "sketch-a", studioId: "studio-a", requestId: "request-104", customer: "Testkund Nora", draft: { title: "Botanisk underarm", tags: "botanik, fineline", bodyPart: "Underarm", strokes: [] }, versions: [], sharedIds: [] },
  { id: "sketch-general", studioId: "studio-a", requestId: null, customer: null, draft: { title: "Fristående bladstudie", tags: "blad, flash", bodyPart: "Valfri", strokes: [] }, versions: [], sharedIds: [] },
] };
export function updateDraft(state: DemoState, id: string, draft: SketchDraft): DemoState {
  return { ...state, sync: "dirty", documents: state.documents.map(d => d.id === id ? { ...d, draft } : d) };
}
export function savePrivate(state: DemoState, id: string, actorStudio: string, mode: "online" | "offline" | "failure", date: string): DemoState {
  const doc = state.documents.find(d => d.id === id);
  if (!doc || doc.studioId !== actorStudio) throw new Error("Studio access denied");
  if (mode !== "online") return { ...state, sync: mode === "offline" ? "local" : "failed" };
  const version: SketchSnapshot = { id: `${id}-v${doc.versions.length + 1}`, number: doc.versions.length + 1, date, content: structuredClone(doc.draft) };
  return { ...state, sync: "saved", documents: state.documents.map(d => d.id === id ? { ...d, versions: [...d.versions, version] } : d) };
}
export function shareVersion(state: DemoState, id: string, versionId: string, actorStudio: string): DemoState {
  const doc = state.documents.find(d => d.id === id);
  if (!doc || doc.studioId !== actorStudio || !doc.requestId || !doc.versions.some(v => v.id === versionId)) throw new Error("Sharing denied");
  return { ...state, documents: state.documents.map(d => d.id === id ? { ...d, sharedIds: [...new Set([...d.sharedIds, versionId])] } : d) };
}
export function customerVersions(doc: SketchDocument) { return doc.versions.filter(v => doc.sharedIds.includes(v.id)); }
export function filterArchive(docs: SketchDocument[], query: string, status: string, date: string) {
  return docs.filter(d => [d.draft.title, d.customer, d.requestId, d.draft.tags, d.draft.bodyPart].join(" ").toLowerCase().includes(query.toLowerCase()) &&
    (!date || d.versions.some(v => v.date.startsWith(date))) &&
    (status === "all" || (status === "shared" ? d.sharedIds.length > 0 : status === "saved" ? d.versions.length > 0 : d.versions.length === 0)));
}
/* ---- Round 2: revisions, conflicts, tabs, version-bound comments, private layers ---- */
export type TabEditor = { tab: string; docId: string; baseRevision: number; draft: SketchDraft & { internalNotes?: string; privateLayers?: string[] } };
export type SaveResult = { ok: true; state: DemoState; revision: number } | { ok: false; reason: "conflict" | "offline" | "failure" | "denied"; state: DemoState; serverRevision: number };
/** Server head revision = number of saved versions. */
export const headRevision = (doc: SketchDocument) => doc.versions.length;

/** Atomic compare-and-save: a stale tab never overwrites; both drafts are kept for the user to choose. */
export function saveFromTab(state: DemoState, ed: TabEditor, actorStudio: string, mode: "online" | "offline" | "failure", date: string): SaveResult {
  const doc = state.documents.find(d => d.id === ed.docId);
  if (!doc || doc.studioId !== actorStudio) return { ok: false, reason: "denied", state, serverRevision: -1 };
  const head = headRevision(doc);
  if (mode !== "online") return { ok: false, reason: mode, state: { ...state, sync: mode === "offline" ? "local" : "failed" }, serverRevision: head };
  if (ed.baseRevision !== head) return { ok: false, reason: "conflict", state, serverRevision: head };
  const next = { ...state, documents: state.documents.map(d => d.id === doc.id ? { ...d, draft: { title: ed.draft.title, tags: ed.draft.tags, bodyPart: ed.draft.bodyPart, strokes: ed.draft.strokes } } : d) };
  return { ok: true, state: savePrivate(next, doc.id, actorStudio, "online", date), revision: head + 1 };
}

/** What a customer receives for a shared version: flat artwork + title only. Internal notes/layers never travel. */
export function customerPayload(v: SketchSnapshot) {
  return { versionId: v.id, number: v.number, title: v.content.title, strokes: [...v.content.strokes] };
}

export type VersionComment = { versionId: string; author: "customer" | "studio"; body: string };
/** A customer may comment only on a version that was explicitly shared with them; the comment is pinned to it. */
export function addCustomerComment(doc: SketchDocument, comments: VersionComment[], versionId: string, body: string): VersionComment[] {
  if (!doc.sharedIds.includes(versionId)) throw new Error("Version not shared with this customer");
  return [...comments, { versionId, author: "customer", body }];
}
