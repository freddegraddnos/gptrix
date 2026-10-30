import type { PhotoPose } from "./photoTattoo";

/** Private, device-only recovery. Never sent to analytics or a public bucket. */
export type PhotoTryOnDraft = {
  version: 1;
  photoDataUrl: string;
  motifId: string;
  pose: PhotoPose;
  updatedAt: number;
};

const DB = "inksimulator-photo-draft";
const STORE = "drafts";
const KEY = "current";
export const PHOTO_DRAFT_MAX_AGE = 24 * 60 * 60 * 1000;

export function parsePhotoTryOnDraft(value: unknown, now = Date.now()): PhotoTryOnDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as PhotoTryOnDraft;
  if (
    draft.version !== 1 ||
    typeof draft.photoDataUrl !== "string" ||
    !/^data:image\/(?:png|jpeg|jpg|webp|gif|avif|heic|heif);base64,/i.test(draft.photoDataUrl) ||
    typeof draft.motifId !== "string" ||
    !draft.motifId ||
    draft.motifId.length > 200 ||
    !Number.isFinite(draft.updatedAt) ||
    draft.updatedAt > now ||
    now - draft.updatedAt > PHOTO_DRAFT_MAX_AGE
  )
    return null;
  const pose = draft.pose;
  if (
    !pose ||
    ![pose.x, pose.y, pose.scale, pose.rotation, pose.bend].every(Number.isFinite) ||
    pose.x < 0 ||
    pose.x > 1 ||
    pose.y < 0 ||
    pose.y > 1 ||
    pose.scale < 0.2 ||
    pose.scale > 4 ||
    pose.bend < 90 ||
    pose.bend > 180
  )
    return null;
  return draft;
}

function request<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Device storage unavailable"));
      return;
    }
    const opening = indexedDB.open(DB, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error("Device storage is blocked"));
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction(STORE, mode);
      const operation = action(transaction.objectStore(STORE));
      // A request's success is not a committed write (quota errors can abort later).
      transaction.oncomplete = () => {
        db.close();
        resolve(operation.result);
      };
      transaction.onabort = transaction.onerror = () => {
        db.close();
        reject(transaction.error ?? new Error("Device storage failed"));
      };
    };
  });
}

// Keep user edits and deletion ordered, including slow database opens.
let writes: Promise<unknown> = Promise.resolve();
export function savePhotoTryOnDraft(draft: PhotoTryOnDraft): Promise<void> {
  if (!parsePhotoTryOnDraft(draft)) return Promise.reject(new Error("Invalid photo draft"));
  const next = writes
    .catch(() => undefined)
    .then(() => request("readwrite", (s) => s.put(draft, KEY)))
    .then(() => undefined);
  writes = next;
  return next;
}

export async function loadPhotoTryOnDraft(): Promise<PhotoTryOnDraft | null> {
  await writes.catch(() => undefined);
  const value = await request("readonly", (s) => s.get(KEY));
  const draft = parsePhotoTryOnDraft(value);
  if (value && !draft) await deletePhotoTryOnDraft();
  return draft;
}

export function deletePhotoTryOnDraft(): Promise<void> {
  const next = writes.catch(() => undefined).then(() => request("readwrite", (s) => s.delete(KEY)));
  writes = next;
  return next;
}
