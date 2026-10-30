/** Private local intake references survive login/reload; never sent without explicit submit. */
export type IntakeReference = { id: string; file: File; uploaded?: boolean };
const DB = "inkvision-request-drafts";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("references");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Local storage is blocked"));
  });
}
async function transaction<T>(key: string, write?: IntakeReference[] | null): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("references", write === undefined ? "readonly" : "readwrite");
    const store = tx.objectStore("references");
    const request =
      write === undefined
        ? store.get(key)
        : write === null
          ? store.delete(key)
          : store.put(write, key);
    tx.oncomplete = () => {
      db.close();
      resolve(request.result as T);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Local storage unavailable"));
    };
  });
}
export const readRequestFiles = (key: string) => transaction<IntakeReference[] | undefined>(key);
export const saveRequestFiles = (key: string, files: IntakeReference[]) =>
  transaction<void>(key, files);
export const clearRequestFiles = (key: string) => transaction<void>(key, null);
