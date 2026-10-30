import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Brush, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyBookingFile } from "@/lib/bookingScan.functions";
import { logSlotEvent } from "@/lib/slotEvents";
import {
  bookingFileUrl,
  isPaintProject,
  isPreviewable,
  KIND_LABEL,
  type BookingFile,
} from "@/lib/bookingFiles";
import { setPaintPrefill, setPaintSaveTarget , setPaintReturnTo} from "@/lib/paintHandoff";
import { listMyMotifs, type MyMotif } from "@/lib/myMotifs";

import { tx, useUiLang } from "@/lib/uiLang";
type Role = "studio" | "client";

/** Points /rita at this booking so finished artwork lands back in the timeline. */
function attachBooking(slotId: string, role: Role, label?: string) {
  setPaintSaveTarget({ slotId, role, label });
}

/**
 * Opens the drawing studio from a booking file: flat images become a locked
 * reference to draw on top of, saved `.inkproj.json` artwork reopens with its
 * whole layer stack.
 */
export function OpenFileInStudioButton({
  file,
  slotId,
  role,
}: {
  file: BookingFile;
  slotId: string;
  role: Role;
}) {
  useUiLang();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const project = isPaintProject(file.name);
  if (!project && !isPreviewable(file.name)) return null;

  const open = async () => {
    setBusy(true);
    try {
      const signed = await bookingFileUrl(file.id);
      setPaintPrefill({
        url: signed.url,
        name: file.name,
        mode: project ? "project" : "background",
      });
      attachBooking(slotId, role);
      setPaintReturnTo();
      await navigate({ to: "/rita" });
    } catch {
      toast.error(tx("Could not open the file in the drawing studio"));
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      aria-label={
        project
          ? tx("Continue editing {file} in the drawing studio", { file: file.name })
          : tx("Draw on {file} in the drawing studio", { file: file.name })
      }
      title={project ? tx("Continue editing (all layers)") : tx("Draw on this as a locked reference")}
      className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-accent disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Brush className="size-3.5" />}
    </button>
  );
}

/**
 * Booking-card actions for the drawing studio: draw on the latest sketch with
 * delivery wired back into this booking, and attach a design saved in
 * "My designs" so it can be reopened in /rita without rebuilding it.
 */
export function BookingStudioActions({
  slotId,
  role,
  files,
  onChanged,
}: {
  slotId: string;
  role: Role;
  files: BookingFile[];
  onChanged?: () => void | Promise<void>;
}) {
  useUiLang();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [motifs, setMotifs] = useState<MyMotif[]>([]);

  useEffect(() => {
    if (picking) setMotifs(listMyMotifs());
  }, [picking]);

  const sketch =
    files.find((f) => isPaintProject(f.name)) ?? files.find((f) => isPreviewable(f.name));

  const drawOnSketch = async () => {
    setBusy(true);
    try {
      if (sketch) {
        const signed = await bookingFileUrl(sketch.id);
        setPaintPrefill({
          url: signed.url,
          name: sketch.name,
          mode: isPaintProject(sketch.name) ? "project" : "background",
        });
      }
      attachBooking(slotId, role);
      setPaintReturnTo();
      await navigate({ to: "/rita" });
    } catch {
      toast.error(tx("Could not open the drawing studio"));
      setBusy(false);
    }
  };

  const attachMotif = async (motif: MyMotif) => {
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("not_signed_in");
      const blob = await fetch(motif.src).then((r) => r.blob());
      const name = `${motif.name.replace(/[^\w.\-]+/g, "_").slice(0, 60) || "design"}.png`;
      const path = `booking/${slotId}/${crypto.randomUUID()}-${name}`;
      const up = await supabase.storage
        .from("attachments")
        .upload(path, blob, { contentType: blob.type || "image/png" });
      if (up.error) throw up.error;
      const { error } = await supabase.from("booking_files").insert({
        slot_id: slotId,
        uploader_id: userId,
        uploader_role: role,
        name,
        path,
        bucket: "attachments",
        mime_type: blob.type || "image/png",
        size_bytes: blob.size,
      });
      if (error) throw error;
      await logSlotEvent({
        slotId,
        role,
        action: "design_attached",
        note: `${KIND_LABEL.image} · ${motif.name}`,
      });
      await notifyBookingFile({ data: { slotId, fileName: name } }).catch(() => undefined);
      toast.success(tx("Design linked to this booking"), {
        description: tx("It can be opened in the drawing studio from the timeline."),
      });
      setPicking(false);
      await onChanged?.();
    } catch {
      toast.error(tx("Could not link the design"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5 rounded-xl border border-white/10 bg-slate/30 p-2.5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {tx("Drawing studio")}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => void drawOnSketch()}
          disabled={busy}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[11px] font-bold text-ink disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Brush className="size-3" />}
          {sketch ? tx("Draw on the sketch") : tx("Open drawing studio")}
        </button>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[11px] font-bold"
        >
          <Palette className="size-3 text-accent" />
          {tx("From My designs")}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        {tx("Artwork saved from the studio is delivered back here as a flat image plus its editable layers, so it can be reopened later without rebuilding it.")}
      </p>

      {picking && (
        <div className="mt-2">
          {motifs.length === 0 ? (
            <p className="py-2 text-[11px] text-muted-foreground">
              {tx("No saved designs yet — save one from the library or the drawing studio first.")}
            </p>
          ) : (
            <ul className="grid grid-cols-4 gap-1.5">
              {motifs.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => void attachMotif(m)}
                    disabled={busy}
                    className="w-full rounded-lg border border-white/10 bg-ink/50 p-1.5 disabled:opacity-60"
                    aria-label={`Attach ${m.name} to this booking`}
                  >
                    <img
                      src={m.src}
                      alt={m.name}
                      className="aspect-square w-full object-contain"
                    />
                    <span className="mt-1 block truncate text-[9px] text-muted-foreground">
                      {m.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
