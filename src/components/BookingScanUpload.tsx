import { useState } from "react";
import { Box, CheckCircle2, Download, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBookingScanUrl, notifyScanStatus } from "@/lib/bookingScan.functions";
import { logSlotEvent } from "@/lib/slotEvents";
import type { StudioSlot } from "@/hooks/useStudio";

import { tx, useUiLang } from "@/lib/uiLang";
const MAX_BYTES = 60 * 1024 * 1024;

/**
 * Delivery step for the 3D body scan a studio requires on a booking.
 * Both sides see the same status: the client (or the artist, when they scan
 * on site) uploads the model, everyone gets a signed download link.
 */
export function BookingScanUpload({
  slot,
  role,
  onChanged,
}: {
  slot: StudioSlot;
  role: "client" | "studio";
  onChanged?: () => Promise<void> | void;
}) {
  useUiLang();
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const delivered = Boolean(slot.scan_path && slot.scan_delivered_at);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(tx("The file is too large (max 60 MB)."));
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("not_signed_in");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const path = `${uid}/bookings/${slot.id}-${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("scans")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;

      const { error } = await supabase
        .from("studio_slots")
        .update({
          scan_path: path,
          scan_bucket: "scans",
          scan_name: file.name.slice(0, 120),
          scan_by: uid,
          scan_delivered_at: new Date().toISOString(),
        })
        .eq("id", slot.id);
      if (error) throw error;

      await logSlotEvent({
        slotId: slot.id,
        role,
        action: "scan_delivered",
        note: file.name.slice(0, 80),
      });
      await notifyScanStatus({
        data: { slotId: slot.id, status: "delivered", fileName: file.name.slice(0, 120) },
      }).catch(() => undefined);
      toast.success(tx("3D scan delivered — both you and the studio can see it now."));
      await onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the 3D file.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("studio_slots")
        .update({
          scan_path: null,
          scan_name: null,
          scan_by: null,
          scan_delivered_at: null,
        })
        .eq("id", slot.id);
      if (error) throw error;
      await logSlotEvent({ slotId: slot.id, role, action: "scan_removed" });
      await notifyScanStatus({
        data: { slotId: slot.id, status: "removed" },
      }).catch(() => undefined);
      await onChanged?.();
    } catch {
      toast.error(tx("Could not remove the file."));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const res = await getBookingScanUrl({ data: { slotId: slot.id } });
      if (!res.ok) throw new Error(res.reason);
      window.open(res.url, "_blank", "noopener");
    } catch {
      toast.error(tx("Could not open the 3D file."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <Box className="size-4 text-accent" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-accent">
          {tx("3D body scan required")}
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
            delivered ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {delivered ? tx("Delivered") : tx("Waiting for file")}
        </span>
      </div>

      {delivered ? (
        <div className="mt-2 space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            <span className="truncate text-foreground">{slot.scan_name ?? tx("3D model")}</span>
            <span>· {new Date(slot.scan_delivered_at as string).toLocaleString()}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void download()}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-accent disabled:opacity-50"
            >
              {downloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
              {tx("Open file")}
            </button>
            <button
              onClick={() => void remove()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive disabled:opacity-50"
            >
              <X className="size-3" />{" "}{tx("Replace")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-[11px] text-muted-foreground">
            {role === "studio"
              ? tx("Upload the scan or model you captured for this client (GLB, OBJ, ZIP or video).")
              : tx("Upload your 3D body scan or model so the artist can plan the piece (GLB, OBJ, ZIP or video).")}
          </p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-black">
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
            {busy ? tx("Uploading…") : tx("Upload 3D file")}
            <input
              type="file"
              className="hidden"
              accept=".glb,.gltf,.obj,.usdz,.ply,.zip,video/*,image/*"
              disabled={busy}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
        </div>
      )}
    </div>
  );
}
