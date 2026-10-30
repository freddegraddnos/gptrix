// Keeps a try-on (photo with + without tattoo) across the sign-in round trip,
// so the user's image isn't lost when "Send to studio" requires login.
// Stored in IndexedDB because the images are too big for localStorage.

export type PendingTryOn = {
  /** Stable project ID makes retries after an interrupted save idempotent. */
  projectId?: string;
  intent: "send" | "save";
  name: string;
  bodyPart?: string;
  tattooId?: string;
  tattooName?: string;
  widthCm?: number;
  previewDataUrl: string;
  basePhotoDataUrl?: string;
  createdAt: number;
};

const DB = "inksimulator-pending";
const STORE = "kv";
const KEY = "tryon";
const MAX_AGE = 24 * 60 * 60 * 1000;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Device storage is blocked"));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result as T); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? req.error); };
  });
}

export async function stashPendingTryOn(p: Omit<PendingTryOn, "createdAt">) {
  try {
    await run("readwrite", (s) => s.put({ ...p, projectId: p.projectId ?? crypto.randomUUID(), createdAt: Date.now() }, KEY));
    return true;
  } catch {
    return false;
  }
}

/** Read without consuming: only a confirmed cloud save may acknowledge it. */
export async function peekPendingTryOn(): Promise<PendingTryOn | null> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(KEY);
      let result: PendingTryOn | null = null;
      req.onsuccess = () => {
        const value = req.result as PendingTryOn | undefined;
        if (!value) return;
        if (Date.now() - value.createdAt > MAX_AGE) { store.delete(KEY); return; }
        // Upgrade in the same transaction: two tabs get the same recovery ID.
        if (!value.projectId) {
          value.projectId = crypto.randomUUID();
          store.put(value, KEY);
        }
        result = value;
      };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    return null;
  }
}

/** Do not remove newer work saved while an earlier upload was in flight. */
export async function acknowledgePendingTryOn(saved: PendingTryOn): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(KEY);
    req.onsuccess = () => {
      const current = req.result as PendingTryOn | undefined;
      if (current && current.projectId === saved.projectId && current.createdAt === saved.createdAt) store.delete(KEY);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
