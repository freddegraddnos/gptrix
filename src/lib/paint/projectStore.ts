/**
 * Local project library.
 *
 * Saved sketches live in IndexedDB on the device: one record per project plus
 * one record per saved version, so the artist can always step back to an
 * earlier state of a drawing. Versions hold a full `ProjectFile`, which makes
 * every entry independently loadable (no diff chain to replay).
 */

import type { ProjectFile } from "./project";

const DB_NAME = "ritstudio-projects";
const DB_VERSION = 1;
const PROJECTS = "projects";
const VERSIONS = "versions";

/** Versions kept per project; older ones are pruned on save. */
export const VERSION_LIMIT = 20;

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Small PNG data URL preview of the latest version. */
  thumb: string;
  widthMm: number;
  heightMm: number;
}

export interface VersionRecord {
  id: string;
  projectId: string;
  createdAt: number;
  label: string;
  thumb: string;
  file: ProjectFile;
}

export interface VersionMeta {
  id: string;
  projectId: string;
  createdAt: number;
  label: string;
  thumb: string;
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function projectsSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!projectsSupported()) return Promise.reject(new Error("Saving is not supported in this browser"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECTS)) {
          db.createObjectStore(PROJECTS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(VERSIONS)) {
          const store = db.createObjectStore(VERSIONS, { keyPath: "id" });
          store.createIndex("projectId", "projectId");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("The project library could not be opened"));
    });
  }
  return dbPromise;
}

function tx<T>(
  stores: string[],
  mode: IDBTransactionMode,
  run: (t: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        let result: T;
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error ?? new Error("The project library could not be written"));
        t.onabort = () => reject(t.error ?? new Error("The project library could not be written"));
        void Promise.resolve(run(t)).then((value) => {
          result = value;
        }, reject);
      }),
  );
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Request failed"));
  });
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const all = await tx([PROJECTS], "readonly", (t) =>
    req(t.objectStore(PROJECTS).getAll() as IDBRequest<ProjectRecord[]>),
  );
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listVersions(projectId: string): Promise<VersionMeta[]> {
  const all = await tx([VERSIONS], "readonly", (t) =>
    req(
      t.objectStore(VERSIONS).index("projectId").getAll(projectId) as IDBRequest<VersionRecord[]>,
    ),
  );
  return all
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ id, projectId: pid, createdAt, label, thumb }) => ({
      id,
      projectId: pid,
      createdAt,
      label,
      thumb,
    }));
}

export async function getVersion(id: string): Promise<VersionRecord | null> {
  const record = await tx([VERSIONS], "readonly", (t) =>
    req(t.objectStore(VERSIONS).get(id) as IDBRequest<VersionRecord | undefined>),
  );
  return record ?? null;
}

export async function latestVersion(projectId: string): Promise<VersionRecord | null> {
  const versions = await listVersions(projectId);
  const newest = versions[0];
  return newest ? getVersion(newest.id) : null;
}

export interface SaveVersionInput {
  /** Existing project to add a version to; omitted for a brand new project. */
  projectId?: string | undefined;
  name: string;
  label?: string;
  thumb: string;
  file: ProjectFile;
  widthMm: number;
  heightMm: number;
}

/** Writes a new version, creates the project when needed and prunes old ones. */
export async function saveVersion(
  input: SaveVersionInput,
): Promise<{ projectId: string; versionId: string }> {
  const now = Date.now();
  const projectId = input.projectId ?? newId("project");
  const versionId = newId("version");

  await tx([PROJECTS, VERSIONS], "readwrite", async (t) => {
    const projects = t.objectStore(PROJECTS);
    const existing = await req(projects.get(projectId) as IDBRequest<ProjectRecord | undefined>);
    const record: ProjectRecord = {
      id: projectId,
      name: input.name.trim() || existing?.name || "Untitled sketch",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      thumb: input.thumb,
      widthMm: input.widthMm,
      heightMm: input.heightMm,
    };
    projects.put(record);

    const versions = t.objectStore(VERSIONS);
    versions.put({
      id: versionId,
      projectId,
      createdAt: now,
      label: input.label?.trim() || new Date(now).toLocaleString(),
      thumb: input.thumb,
      file: input.file,
    } satisfies VersionRecord);

    const mine = await req(
      versions.index("projectId").getAll(projectId) as IDBRequest<VersionRecord[]>,
    );
    const stale = mine
      .concat()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(VERSION_LIMIT);
    for (const old of stale) versions.delete(old.id);
  });

  return { projectId, versionId };
}

export async function renameProject(id: string, name: string): Promise<void> {
  await tx([PROJECTS], "readwrite", async (t) => {
    const store = t.objectStore(PROJECTS);
    const record = await req(store.get(id) as IDBRequest<ProjectRecord | undefined>);
    if (!record) return;
    store.put({ ...record, name: name.trim() || record.name });
  });
}

export async function deleteProject(id: string): Promise<void> {
  await tx([PROJECTS, VERSIONS], "readwrite", async (t) => {
    t.objectStore(PROJECTS).delete(id);
    const versions = t.objectStore(VERSIONS);
    const mine = await req(versions.index("projectId").getAll(id) as IDBRequest<VersionRecord[]>);
    for (const v of mine) versions.delete(v.id);
  });
}

export async function deleteVersion(id: string): Promise<void> {
  await tx([VERSIONS], "readwrite", (t) => {
    t.objectStore(VERSIONS).delete(id);
  });
}
