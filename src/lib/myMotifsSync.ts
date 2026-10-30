/**
 * Keeps "My designs" in sync with the signed-in user's account: local
 * designs are uploaded once, account designs are pulled back down, so the
 * user keeps everything after signing out or switching device.
 */
import {
  listMyMotifs,
  saveMyMotif,
  setMyMotifRemoteId,
  type MyMotif,
} from "@/lib/myMotifs";
import { listUserDesigns, saveUserDesign } from "@/lib/userDesigns.functions";

let syncing = false;
let syncedFor: string | null = null;

function kindOf(m: MyMotif): "upload" | "drawing" | "text" | "ai" {
  if (m.source === "text") return "text";
  if (m.source === "ai") return "ai";
  if (m.source === "share") return "upload";
  return m.source === "upload" ? "upload" : "drawing";
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Push local-only designs up, pull account designs down. Safe to call often. */
export async function syncMyMotifs(userId: string | undefined) {
  if (typeof window === "undefined" || !userId) return;
  if (syncing || syncedFor === userId) return;
  syncing = true;
  try {
    const remote = await listUserDesigns();
    const local = listMyMotifs();
    const remoteLocalIds = new Set(
      remote.map((r) => r.localId).filter((v): v is string => Boolean(v)),
    );

    // Up: anything this device has that the account does not.
    for (const m of local) {
      if (m.remoteId || remoteLocalIds.has(m.id)) continue;
      if (!m.src.startsWith("data:image/")) continue;
      try {
        const saved = await saveUserDesign({
          data: {
            name: m.name,
            kind: kindOf(m),
            widthCm: m.widthCm,
            localId: m.id,
            dataUrl: m.src,
          },
        });
        setMyMotifRemoteId(m.id, saved.id);
      } catch (err) {
        console.error("[designs] upload failed", err);
      }
    }

    // Down: account designs this device has never seen.
    const localIds = new Set(listMyMotifs().map((m) => m.id));
    const localRemoteIds = new Set(
      listMyMotifs()
        .map((m) => m.remoteId)
        .filter((v): v is string => Boolean(v)),
    );
    for (const r of remote) {
      if (localRemoteIds.has(r.id)) continue;
      if (r.localId && localIds.has(r.localId)) continue;
      if (!r.url) continue;
      const dataUrl = await urlToDataUrl(r.url);
      if (!dataUrl) continue;
      const created = saveMyMotif({
        name: r.name,
        src: dataUrl,
        widthCm: r.widthCm,
        source: r.kind === "drawing" || r.kind === "sleeve" ? "upload" : r.kind,
      });
      setMyMotifRemoteId(created.id, r.id);
    }
    syncedFor = userId;
  } catch (err) {
    console.error("[designs] sync failed", err);
  } finally {
    syncing = false;
  }
}

/** Called after signing out so the next user syncs from scratch. */
export function resetMyMotifsSync() {
  syncedFor = null;
}
