import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Download, Eye, Loader2, Package, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyBookingFile, notifyScanStage } from "@/lib/bookingScan.functions";
import {
  bookingFileUrl,
  downloadBookingBundle,
  fileKind,
  is3dFile,
  isPreviewable,
  isViewableModel,
  KIND_LABEL,
  listBookingFiles,
  nextKindVersion,
  prettyBytes,
  type BookingFile,
} from "@/lib/bookingFiles";
import { checkSvgFile } from "@/lib/svgScale";
import { FilePreviewSheet } from "@/components/FilePreviewSheet";
import { logSlotEvent } from "@/lib/slotEvents";
import { ModelViewerSheet } from "@/components/ModelViewerLite";
import { ScanStatusTracker } from "@/components/ScanStatusTracker";
import { deriveScanStatus } from "@/lib/scanStatus";
import { BookingStudioActions, OpenFileInStudioButton } from "@/components/BookingStudioActions";

import { tx, useUiLang } from "@/lib/uiLang";
const MAX_BYTES = 80 * 1024 * 1024;

/**
 * Files exchanged around one booking — stencils, PSD/AI/Procreate exports and
 * 3D models. Both the studio and the client can upload and download; each file
 * lives privately in the `attachments` bucket under `booking/<slotId>/`.
 * Every upload gets a delivery version and is written to the booking timeline.
 */
export function BookingFiles({
  slotId,
  role,
  requires3d = false,
  scanDeliveredAt = null,
}: {
  slotId: string;
  role: "studio" | "client";
  /** Show the automatic 3D delivery status track for this booking. */
  requires3d?: boolean;
  scanDeliveredAt?: string | null;
}) {
  useUiLang();
  const [files, setFiles] = useState<BookingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [flat, setFlat] = useState<{ url: string; name: string; caption?: string } | null>(null);
  const [expectedMm, setExpectedMm] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFiles(await listBookingFiles(slotId));
    setLoading(false);
  }, [slotId]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    void load();
  }, [load]);

  // The size the spec pack asked for — used to validate uploaded 1:1 SVGs.
  useEffect(() => {
    let alive = true;
    void supabase
      .from("slot_events")
      .select("note")
      .eq("slot_id", slotId)
      .eq("action", "spec_pack_sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const mm = data?.note?.match(/(\d+(?:\.\d+)?)\s*mm/i);
        if (alive && mm) setExpectedMm(Number(mm[1]));
      });
    return () => {
      alive = false;
    };
  }, [slotId]);

  /** Announces the derived 3D stage; the server skips unchanged stages. */
  const announceStage = useCallback(
    async (rows: BookingFile[]) => {
      if (!requires3d) return;
      const status = deriveScanStatus({ scanDeliveredAt, files: rows });
      await notifyScanStage({
        data: { slotId, stage: status.stage, label: status.label },
      }).catch(() => undefined);
    },
    [requires3d, scanDeliveredAt, slotId],
  );

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(tx("File is too large"), { description: tx("Max 80 MB per file.") });
      return;
    }
    if (/\.svg$/i.test(file.name)) {
      try {
        const check = await checkSvgFile(file, expectedMm);
        if (!check.ok) {
          toast.warning(tx("This SVG may not be 1:1"), {
            description: `${check.problems[0]} (${check.hint})`,
            duration: 9000,
          });
        } else {
          toast.info(`1:1 scale verified · ${check.hint}`);
        }
      } catch {
        /* validation is advisory only */
      }
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("not_signed_in");
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `booking/${slotId}/${crypto.randomUUID()}-${safe}`;
      const up = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) throw up.error;

      const name = file.name.slice(0, 140);
      const { error } = await supabase.from("booking_files").insert({
        slot_id: slotId,
        uploader_id: userId,
        uploader_role: role,
        name,
        path,
        bucket: "attachments",
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) throw error;

      const is3d = is3dFile(name);
      const kind = fileKind(name);
      const version = nextKindVersion(files, kind);
      await logSlotEvent({
        slotId,
        role,
        action: is3d ? "file_3d_uploaded" : "file_uploaded",
        note: `${KIND_LABEL[kind]} v${version} · ${name}`,
      });
      await notifyBookingFile({ data: { slotId, fileName: name } }).catch(() => undefined);
      toast.success(`${KIND_LABEL[kind]} shared as v${version}`, {
        description: tx("The other party was notified."),
      });
      const rows = await listBookingFiles(slotId);
      setFiles(rows);
      await announceStage(rows);
    } catch (err) {
      toast.error(tx("Upload failed"), {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (f: BookingFile) => {
    try {
      const signed = await bookingFileUrl(f.id);
      const a = document.createElement("a");
      a.href = signed.url;
      a.download = signed.name;
      a.rel = "noopener";
      a.click();
    } catch {
      toast.error(tx("Could not open the file"), { description: tx("Ask for it to be re-uploaded.") });
    }
  };

  const view3d = async (f: BookingFile) => {
    try {
      const signed = await bookingFileUrl(f.id);
      setPreview({ url: signed.url, name: f.name });
    } catch {
      toast.error(tx("Could not open the 3D file"));
    }
  };

  const viewFlat = async (f: BookingFile) => {
    try {
      const signed = await bookingFileUrl(f.id);
      setFlat({
        url: signed.url,
        name: f.name,
        caption: `${KIND_LABEL[f.kind]} v${f.kindVersion} · ${new Date(f.created_at).toLocaleString()}`,
      });
    } catch {
      toast.error(tx("Could not open the preview"));
    }
  };

  const downloadAll = async () => {
    setZipping(true);
    try {
      const n = await downloadBookingBundle(slotId, files);
      toast.success(`Packaged ${n} file${n === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(tx("Could not build the package"), {
        description: err instanceof Error && err.message === "no_files" ? "No files yet." : "Try again.",
      });
    } finally {
      setZipping(false);
    }
  };

  const remove = async (f: BookingFile) => {
    setBusy(true);
    await supabase.storage.from(f.bucket || "attachments").remove([f.path]);
    await supabase.from("booking_files").delete().eq("id", f.id);
    await logSlotEvent({
      slotId,
      role,
      action: f.is3d ? "file_3d_removed" : "file_removed",
      note: `${KIND_LABEL[f.kind]} v${f.kindVersion} · ${f.name}`,
    });
    setBusy(false);
    const rows = await listBookingFiles(slotId);
    setFiles(rows);
    await announceStage(rows);
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-ink/40 p-3">
      {requires3d && !loading && (
        <ScanStatusTracker
          status={deriveScanStatus({ scanDeliveredAt, files })}
        />
      )}
      <div className="mb-2 mt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {tx("Booking files")}
        </span>
        <div className="flex items-center gap-1.5">
          {files.length > 0 && (
            <button
              type="button"
              onClick={() => void downloadAll()}
              disabled={zipping}
              className="flex h-8 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[11px] font-bold disabled:opacity-60"
            >
              {zipping ? <Loader2 className="size-3 animate-spin" /> : <Package className="size-3" />}
              {tx("Download all")}
            </button>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-8 items-center gap-1 rounded-lg bg-accent px-3 text-[11px] font-bold text-ink disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
            {tx("Send file")}
          </button>
        </div>
      </div>
      <BookingStudioActions slotId={slotId} role={role} files={files} onChanged={load} />

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">
        {tx("Share stencils and exports — PSD, AI, SVG, PDF, PNG, .procreate or 3D models (OBJ, GLB, STL, USDZ). Max 80 MB. GLB files open in the built-in 3D viewer; every upload is versioned and shows up in the booking timeline.")}
      </p>

      {loading ? (
        <p className="py-3 text-center text-[11px] text-muted-foreground">{tx("Loading…")}</p>
      ) : files.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-muted-foreground">{tx("No files yet.")}</p>
      ) : (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate/40 px-2.5 py-2"
            >
              <Paperclip className="size-3.5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">
                  <span className="mr-1.5 rounded bg-accent/15 px-1 text-[10px] font-bold text-accent">
                    {KIND_LABEL[f.kind]} v{f.kindVersion}
                  </span>
                  {f.name}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {f.uploader_role === "studio" ? tx("Studio") : tx("Client")} ·{" "}
                  {new Date(f.created_at).toLocaleString()} {prettyBytes(f.size_bytes)}
                </span>
              </span>
              {isPreviewable(f.name) && (
                <button
                  type="button"
                  onClick={() => void viewFlat(f)}
                  aria-label={`Preview ${f.name}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-accent"
                >
                  <Eye className="size-3.5" />
                </button>
              )}
              <OpenFileInStudioButton file={f} slotId={slotId} role={role} />
              {isViewableModel(f.name) && (
                <button
                  type="button"
                  onClick={() => void view3d(f)}
                  aria-label={`View ${f.name} in 3D`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-accent"
                >
                  <Box className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void download(f)}
                aria-label={`Download ${f.name}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3.5" />
              </button>
              {uid === f.uploader_id && (
                <button
                  type="button"
                  onClick={() => void remove(f)}
                  disabled={busy}
                  aria-label={`Remove ${f.name}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {flat && (
        <FilePreviewSheet
          src={flat.url}
          name={flat.name}
          caption={flat.caption}
          onClose={() => setFlat(null)}
        />
      )}

      {preview && (
        <ModelViewerSheet
          src={preview.url}
          name={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
