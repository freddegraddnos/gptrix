/**
 * "My motifs" — the user's own, extracted tattoo motifs.
 * Stored locally (localStorage) as transparent PNG data URLs so they can be
 * used both in the AR camera and in Live Try-On without a network.
 */

export type MyMotif = {
  id: string;
  name: string;
  /** Transparent PNG as data URL */
  src: string;
  /** Realistic default width on skin in cm */
  widthCm: number;
  createdAt: number;
  source?: "upload" | "share" | "text" | "ai";
  /** Row id in the user's account, once this design has been synced. */
  remoteId?: string;
};

const KEY = "inkvision.mymotifs.v1";
const EVT = "inkvision:mymotifs";
export const SHARED_INBOX_KEY = "inkvision.shared.image";

function read(): MyMotif[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as MyMotif[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: MyMotif[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota — drop the oldest and try again
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new Event(EVT));
}

export function listMyMotifs(): MyMotif[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function getMyMotif(id: string): MyMotif | undefined {
  return read().find((m) => m.id === id);
}

export function saveMyMotif(input: {
  name: string;
  src: string;
  widthCm?: number;
  source?: MyMotif["source"];
}): MyMotif {
  const motif: MyMotif = {
    id: `my_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim() || "Custom motif",
    src: input.src,
    widthCm: input.widthCm ?? 8,
    createdAt: Date.now(),
    source: input.source ?? "upload",
  };
  write([motif, ...read()].slice(0, 40));
  void import("@/lib/track").then((m) => {
    m.track("design_saved", { source: motif.source });
    m.track("tryon_completed", { via: "save" });
  });
  return motif;
}

/** Also removes the copy stored in the signed-in user's account. */
function forgetRemote(motifs: MyMotif[]) {
  const remoteIds = motifs
    .map((m) => m.remoteId)
    .filter((v): v is string => Boolean(v));
  if (!remoteIds.length) return;
  void (async () => {
    try {
      const { deleteUserDesign } = await import("@/lib/userDesigns.functions");
      for (const id of remoteIds) await deleteUserDesign({ data: { id } });
    } catch {
      /* stays on the device only */
    }
  })();
}

export function deleteMyMotif(id: string) {
  const list = read();
  forgetRemote(list.filter((m) => m.id === id));
  write(list.filter((m) => m.id !== id));
}

export function deleteMyMotifs(ids: string[]) {
  const set = new Set(ids);
  const list = read();
  forgetRemote(list.filter((m) => set.has(m.id)));
  write(list.filter((m) => !set.has(m.id)));
}

export function renameMyMotif(id: string, name: string) {
  write(
    read().map((m) =>
      m.id === id ? { ...m, name: name.trim() || m.name } : m,
    ),
  );
}

/** Remember that this design now also lives in the signed-in user's account. */
export function setMyMotifRemoteId(id: string, remoteId: string) {
  write(read().map((m) => (m.id === id ? { ...m, remoteId } : m)));
}

export function subscribeMyMotifs(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Image shared into the app via "Share to InkSimulator". */
export function takeSharedImage(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(SHARED_INBOX_KEY);
  if (v) window.localStorage.removeItem(SHARED_INBOX_KEY);
  return v;
}
