import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import Model3DViewer from "@/components/Model3DViewer";
import { getSharedScan, type SharedScan, type SharedScanError } from "@/lib/scanShare.functions";
import { addAnnotationByToken, listAnnotationsByToken } from "@/lib/scanAnnotations";
import type { ScanAnnotation } from "@/components/Model3DViewer";

import { tx, useUiLang } from "@/lib/uiLang";
type Share = {
  id: string;
  token: string;
  note: string | null;
  expires_at: string;
  revoked: boolean;
  created_at: string;
};

type ScanState = { loading: boolean; scan: SharedScan | null; error: string | null };

/** 3D body scans clients have sent to this studio, viewable inline. */
export function ArtistScans({ artistId }: { artistId: string }) {
  useUiLang();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [scans, setScans] = useState<Record<string, ScanState>>({});
  const [notes, setNotes] = useState<Record<string, ScanAnnotation[]>>({});

  const refreshNotes = async (token: string, shareId: string) => {
    const list = await listAnnotationsByToken(token);
    setNotes((n) => ({ ...n, [shareId]: list }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("scan_shares")
      .select("id, token, note, expires_at, revoked, created_at")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false });
    setShares((data ?? []) as Share[]);
    setLoading(false);
  }, [artistId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (share: Share) => {
    if (open === share.id) {
      setOpen(null);
      return;
    }
    setOpen(share.id);
    if (scans[share.id]?.scan || scans[share.id]?.loading) return;
    setScans((s) => ({ ...s, [share.id]: { loading: true, scan: null, error: null } }));
    try {
      const res = (await getSharedScan({ data: { token: share.token } })) as
        | SharedScan
        | SharedScanError;
      if (res.ok) {
        setScans((s) => ({ ...s, [share.id]: { loading: false, scan: res, error: null } }));
        void refreshNotes(share.token, share.id);
      } else {
        const label =
          res.reason === "expired"
            ? "This scan link has expired."
            : res.reason === "not_ready"
              ? "The 3D model is still processing."
              : "Scan not found.";
        setScans((s) => ({ ...s, [share.id]: { loading: false, scan: null, error: label } }));
      }
    } catch {
      setScans((s) => ({
        ...s,
        [share.id]: { loading: false, scan: null, error: "Could not load the scan." },
      }));
    }
  };

  if (loading) {
    return (
      <div className="py-10 grid place-items-center">
        <Loader2 className="size-5 animate-spin text-accent" />
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tx("No 3D scans yet. Clients can send a scan of the body part straight to your studio from their scan page.")}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {shares.map((s) => {
        const expired = new Date(s.expires_at).getTime() < Date.now() || s.revoked;
        const state = scans[s.id];
        const isOpen = open === s.id;
        return (
          <li key={s.id} className="rounded-2xl border border-white/5 bg-slate p-4">
            <div className="flex items-center gap-2">
              <Box className="size-4 text-accent" />
              <span className="font-semibold text-sm">{tx("3D scan")}</span>
              <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
                {expired ? "expired" : new Date(s.created_at).toLocaleDateString()}
              </span>
            </div>
            {s.note && <p className="mt-2 text-sm text-muted-foreground">{s.note}</p>}

            {!expired && (
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <button
                  onClick={() => void toggle(s)}
                  className="h-10 rounded-xl bg-accent text-ink text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5"
                >
                  <ChevronDown
                    className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                  {isOpen ? tx("Hide viewer") : tx("Inspect in 3D")}
                </button>
                <a
                  href={`/s/${s.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-3 rounded-xl border border-white/10 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="size-3.5" />{" "}{tx("Open")}
                </a>
              </div>
            )}

            {isOpen && !expired && (
              <div className="mt-3">
                {state?.loading && (
                  <div className="py-8 grid place-items-center">
                    <Loader2 className="size-5 animate-spin text-accent" />
                  </div>
                )}
                {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
                {state?.scan && (
                  <>
                    <Model3DViewer
                      modelUrl={state.scan.modelUrl}
                      scaleFactor={state.scan.scaleFactor}
                      calibrated={state.scan.calibrated}
                      annotations={notes[s.id] ?? []}
                      onAddAnnotation={async (point, body) => {
                        await addAnnotationByToken(s.token, point, body, "Studio");
                        await refreshNotes(s.token, s.id);
                      }}
                      className="h-[380px]"
                    />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {state.scan.bodyPart ? `${state.scan.bodyPart} · ` : ""}
                      {tx("Drag to rotate, pinch or scroll to zoom")}
                      {state.scan.calibrated ? tx(", tap two points to measure in cm.") : "."}
                    </p>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
