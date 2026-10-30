import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Loader2, Ruler, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyBookingFile } from "@/lib/bookingScan.functions";
import { logSlotEvent } from "@/lib/slotEvents";
import { KIND_LABEL, fileKind, listBookingFiles } from "@/lib/bookingFiles";
import { listMyMotifs, type MyMotif } from "@/lib/myMotifs";
import { buildMeasuredPng, buildMotifSvg } from "@/lib/vectorExport";
import { buildPrintSheetPdf, downloadBlob } from "@/lib/printExport";

import { tx, useUiLang } from "@/lib/uiLang";
type Pick = { name: string; src: string; widthMm: number };

function safeName(name: string) {
  return (name.replace(/[^\w.\-]+/g, "_").slice(0, 60) || "motif").toLowerCase();
}

/**
 * When a studio does not require a 3D scan, the client can still send an
 * exact spec pack instead: a 1:1 vector SVG, a print-ready PDF and a
 * reference image with millimetre dimensions.
 */
export function DesignSpecSender({
  slotId,
  role = "client",
}: {
  slotId: string;
  role?: "client" | "studio";
}) {
  useUiLang();
  const [motifs, setMotifs] = useState<MyMotif[]>([]);
  const [picked, setPicked] = useState<Pick | null>(null);
  const [widthMm, setWidthMm] = useState(80);
  const [busy, setBusy] = useState<"send" | "download" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMotifs(listMyMotifs());
  }, []);

  const heightHint = useMemo(() => `${widthMm} mm wide`, [widthMm]);

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setPicked({ name: file.name.replace(/\.[^.]+$/, ""), src: String(reader.result), widthMm });
    reader.readAsDataURL(file);
  };

  const build = async () => {
    if (!picked) throw new Error("no_motif");
    const base = safeName(picked.name);
    const { svg, heightMm } = await buildMotifSvg({
      imageUrl: picked.src,
      widthMm,
      title: picked.name,
    });
    const pdf = await buildPrintSheetPdf({
      imageUrl: picked.src,
      widthCm: widthMm / 10,
      paper: "a4",
      title: picked.name,
      note: `Requested size ${Math.round(widthMm)} × ${Math.round(heightMm)} mm`,
    });
    const png = await buildMeasuredPng({
      imageUrl: picked.src,
      widthMm,
      title: picked.name,
    });
    return [
      { name: `${base}-1to1.svg`, blob: new Blob([svg], { type: "image/svg+xml" }), type: "image/svg+xml" },
      { name: `${base}-print.pdf`, blob: pdf.blob, type: "application/pdf" },
      { name: `${base}-measurements.png`, blob: png, type: "image/png" },
    ];
  };

  const download = async () => {
    setBusy("download");
    try {
      for (const f of await build()) downloadBlob(f.blob, f.name);
      toast.success(tx("Spec pack downloaded"));
    } catch {
      toast.error(tx("Could not build the spec pack"));
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy("send");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("not_signed_in");
      const files = await build();
      for (const f of files) {
        const path = `booking/${slotId}/${crypto.randomUUID()}-${f.name}`;
        const up = await supabase.storage
          .from("attachments")
          .upload(path, f.blob, { contentType: f.type });
        if (up.error) throw up.error;
        const { error } = await supabase.from("booking_files").insert({
          slot_id: slotId,
          uploader_id: uid,
          uploader_role: role,
          name: f.name,
          path,
          bucket: "attachments",
          mime_type: f.type,
          size_bytes: f.blob.size,
        });
        if (error) throw error;
      }
      // Version stamp per deliverable (1:1 SVG, PDF, measurement image).
      const uploaded = await listBookingFiles(slotId);
      const versions = files
        .map((f) => {
          const row = uploaded.find((u) => u.name === f.name);
          return row ? `${KIND_LABEL[row.kind]} v${row.kindVersion}` : KIND_LABEL[fileKind(f.name)];
        })
        .join(", ");
      await logSlotEvent({
        slotId,
        role,
        action: "spec_pack_sent",
        note: `${picked?.name ?? "Motif"} · ${Math.round(widthMm)} mm · ${versions}`,
      });
      await notifyBookingFile({
        data: { slotId, fileName: files[0].name },
      }).catch(() => undefined);
      toast.success(tx("Vector spec pack sent to the studio"));
    } catch (err) {
      toast.error(tx("Could not send the spec pack"), {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-ink/40 p-3">
      <div className="flex items-center gap-2">
        <Ruler className="size-4 text-accent" />
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          {tx("Send design spec (no 3D needed)")}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {tx("No 3D scan is required for this booking. Send your motif as a 1:1 vector SVG, a print-ready PDF and a reference image with millimetre measurements instead.")}
      </p>

      {motifs.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {motifs.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPicked({ name: m.name, src: m.src, widthMm })}
              aria-label={`Use ${m.name}`}
              className={`size-14 shrink-0 rounded-lg border p-1 ${
                picked?.src === m.src ? "border-accent" : "border-white/10"
              }`}
            >
              <img src={m.src} alt={m.name} className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="h-8 rounded-lg border border-white/10 px-3 text-[11px] font-bold"
        >
          {tx("Upload motif")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onUpload(e.target.files?.[0])}
        />
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {tx("Width")}
          <input
            type="number"
            min={5}
            max={500}
            value={widthMm}
            onChange={(e) => setWidthMm(Math.max(5, Math.min(500, Number(e.target.value) || 0)))}
            className="h-8 w-20 rounded-lg border border-white/10 bg-transparent px-2 text-xs text-foreground"
          />
          mm
        </label>
        <span className="text-[10px] text-muted-foreground">{heightHint}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!picked || busy !== null}
          onClick={() => void send()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[11px] font-bold text-ink disabled:opacity-50"
        >
          {busy === "send" ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
          {tx("Send SVG + PDF + measurements")}
        </button>
        <button
          type="button"
          disabled={!picked || busy !== null}
          onClick={() => void download()}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[11px] font-bold disabled:opacity-50"
        >
          {busy === "download" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <FileDown className="size-3" />
          )}
          {tx("Download")}
        </button>
      </div>
      {!picked && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {tx("Pick a saved design or upload one to enable sending.")}
        </p>
      )}
    </div>
  );
}
