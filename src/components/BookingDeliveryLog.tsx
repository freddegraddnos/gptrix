import { useEffect, useState } from "react";
import { Box, Download, Eye, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  bookingFileUrl,
  downloadBookingBundle,
  isPreviewable,
  isViewableModel,
  KIND_LABEL,
  listBookingFiles,
  prettyBytes,
  type BookingFile,
} from "@/lib/bookingFiles";
import { ModelViewerSheet } from "@/components/ModelViewerLite";
import { FilePreviewSheet } from "@/components/FilePreviewSheet";
import { ScanStatusTracker } from "@/components/ScanStatusTracker";
import { deriveScanStatus } from "@/lib/scanStatus";
import { ScanNotificationPreview } from "@/components/ScanNotificationPreview";
import { ScanNotifyStatus } from "@/components/ScanNotifyStatus";
import { OpenFileInStudioButton } from "@/components/BookingStudioActions";

import { tx, useUiLang } from "@/lib/uiLang";
/**
 * Read-only delivery log for one booking: every shared file with its version,
 * an inline 3D viewer for GLB models and a one-tap zip of everything.
 */
export function BookingDeliveryLog({ slotId }: { slotId: string }) {
  useUiLang();
  const [files, setFiles] = useState<BookingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [zipping, setZipping] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [flat, setFlat] = useState<{ url: string; name: string; caption?: string } | null>(null);
  const [slot, setSlot] = useState<{
    requires_3d: boolean;
    scan_delivered_at: string | null;
    starts_at: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    void listBookingFiles(slotId).then((rows) => {
      if (!alive) return;
      setFiles(rows);
      setLoading(false);
    });
    void supabase
      .from("studio_slots")
      .select("requires_3d, scan_delivered_at, starts_at")
      .eq("id", slotId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setSlot(data);
      });
    return () => {
      alive = false;
    };
  }, [slotId]);


  const open = async (f: BookingFile, as3d: boolean) => {
    try {
      const signed = await bookingFileUrl(f.id);
      if (as3d) {
        setPreview({ url: signed.url, name: f.name });
        return;
      }
      const a = document.createElement("a");
      a.href = signed.url;
      a.download = signed.name;
      a.rel = "noopener";
      a.click();
    } catch {
      toast.error(tx("Could not open the file"));
    }
  };

  const previewFlat = async (f: BookingFile) => {
    try {
      const signed = await bookingFileUrl(f.id);
      setFlat({
        url: signed.url,
        name: f.name,
        caption: `${KIND_LABEL[f.kind]} v${f.kindVersion} · ${
          f.uploader_role === "studio" ? "Studio" : "You"
        } · ${new Date(f.created_at).toLocaleString()}`,
      });
    } catch {
      toast.error(tx("Could not open the preview"));
    }
  };

  const bundle = async () => {
    setZipping(true);
    try {
      const n = await downloadBookingBundle(slotId, files);
      toast.success(`Packaged ${n} file${n === 1 ? "" : "s"}`);
    } catch {
      toast.error(tx("Could not build the package"));
    } finally {
      setZipping(false);
    }
  };

  if (loading) return <Loader2 className="size-4 animate-spin text-accent" />;
  if (files.length === 0 && !slot?.requires_3d) return null;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-ink/40 p-3">
      {slot?.requires_3d && (
        <ScanStatusTracker
          status={deriveScanStatus({ scanDeliveredAt: slot.scan_delivered_at, files })}
        />
      )}
      <div className="mb-2 mt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {tx("Delivery log")}
        </span>
        <button
          type="button"
          onClick={() => void bundle()}
          disabled={zipping}
          className="flex h-8 items-center gap-1 rounded-lg bg-accent px-3 text-[11px] font-bold text-ink disabled:opacity-60"
        >
          {zipping ? <Loader2 className="size-3 animate-spin" /> : <Package className="size-3" />}
          {tx("Download all (zip)")}
        </button>
      </div>
      <ul className="space-y-1.5">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate/40 px-2.5 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs">
                <span className="mr-1.5 rounded bg-accent/15 px-1 text-[10px] font-bold text-accent">
                  {KIND_LABEL[f.kind]} v{f.kindVersion}
                </span>
                {f.name}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {f.uploader_role === "studio" ? tx("Studio") : tx("You")} ·{" "}
                {new Date(f.created_at).toLocaleString()} {prettyBytes(f.size_bytes)}
              </span>
            </span>
            {isPreviewable(f.name) && (
              <button
                type="button"
                onClick={() => void previewFlat(f)}
                aria-label={`Preview ${f.name}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-accent"
              >
                <Eye className="size-3.5" />
              </button>
            )}
            <OpenFileInStudioButton file={f} slotId={slotId} role="client" />
            {isViewableModel(f.name) && (
              <button
                type="button"
                onClick={() => void open(f, true)}
                aria-label={`View ${f.name} in 3D`}
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-accent"
              >
                <Box className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void open(f, false)}
              aria-label={`Download ${f.name}`}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-muted-foreground"
            >
              <Download className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {(["svg", "measurements", "pdf"] as const).some((k) =>
        files.some((f) => f.kind === k),
      ) && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate/30 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {tx("Download a single version")}
          </p>
          <div className="mt-2 space-y-1.5">
            {(["svg", "measurements", "pdf"] as const).map((kind) => {
              const group = files
                .filter((f) => f.kind === kind)
                .sort((a, b) => a.kindVersion - b.kindVersion);
              if (group.length === 0) return null;
              return (
                <div key={kind} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-24 shrink-0 text-[11px] text-muted-foreground">
                    {KIND_LABEL[kind]}
                  </span>
                  {group.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => void open(f, false)}
                      title={`${f.name} · ${new Date(f.created_at).toLocaleString()}`}
                      aria-label={`Download ${KIND_LABEL[kind]} version ${f.kindVersion}`}
                      className="flex h-7 items-center gap-1 rounded-lg border border-white/10 px-2 text-[10px] font-bold text-accent"
                    >
                      <Download className="size-3" />v{f.kindVersion}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {slot?.requires_3d && (
        <>
          <ScanNotificationPreview
            startsAt={slot.starts_at}
            currentStage={
              deriveScanStatus({ scanDeliveredAt: slot.scan_delivered_at, files }).stage
            }
          />
          <ScanNotifyStatus slotId={slotId} />
        </>
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
        <ModelViewerSheet src={preview.url} name={preview.name} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
