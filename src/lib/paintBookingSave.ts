/**
 * Delivering drawing-studio artwork straight into a booking.
 *
 * Two files are written per save so both sides get what they need:
 *   - a flat, transparent PNG of the artwork (the client can view it, print it
 *     or try it on in AR), and
 *   - the full `.inkproj.json` state, so the drawing can be reopened in /rita
 *     with every layer intact instead of being rebuilt from the flat image.
 *
 * Both land in the private `attachments` bucket, get a `booking_files` row (so
 * they are versioned like any other delivery) and are written to the booking
 * timeline.
 */

import { supabase } from "@/integrations/supabase/client";
import { notifyBookingFile } from "@/lib/bookingScan.functions";
import { logSlotEvent } from "@/lib/slotEvents";
import { listBookingFiles, nextKindVersion } from "@/lib/bookingFiles";

function safeName(name: string) {
  return (name.trim() || "artwork").replace(/[^\w.\-]+/g, "_").slice(0, 60);
}

async function uploadOne(
  slotId: string,
  role: "studio" | "client",
  userId: string,
  fileName: string,
  blob: Blob,
) {
  const path = `booking/${slotId}/${crypto.randomUUID()}-${fileName}`;
  const up = await supabase.storage
    .from("attachments")
    .upload(path, blob, { contentType: blob.type || "application/octet-stream" });
  if (up.error) throw up.error;
  const { error } = await supabase.from("booking_files").insert({
    slot_id: slotId,
    uploader_id: userId,
    uploader_role: role,
    name: fileName,
    path,
    bucket: "attachments",
    mime_type: blob.type || null,
    size_bytes: blob.size,
  });
  if (error) throw error;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = head.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function saveArtworkToBooking(input: {
  slotId: string;
  role: "studio" | "client";
  /** Base name without extension, e.g. "Sleeve dragon". */
  name: string;
  /** Flattened artwork as a PNG data URL. */
  artworkPng: string;
  /** Serialised drawing-studio project (full layer stack). */
  project: unknown;
}): Promise<{ version: number }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("not_signed_in");

  const base = safeName(input.name);
  const before = await listBookingFiles(input.slotId);
  const version = nextKindVersion(before, "project");

  await uploadOne(
    input.slotId,
    input.role,
    userId,
    `${base}-v${version}.png`,
    dataUrlToBlob(input.artworkPng),
  );
  await uploadOne(
    input.slotId,
    input.role,
    userId,
    `${base}-v${version}.inkproj.json`,
    new Blob([JSON.stringify(input.project)], { type: "application/json" }),
  );

  await logSlotEvent({
    slotId: input.slotId,
    role: input.role,
    action: "artwork_delivered",
    note: `Artwork project v${version} · ${base} (flat PNG + editable layers)`,
  });
  await notifyBookingFile({
    data: { slotId: input.slotId, fileName: `${base}-v${version}.png` },
  }).catch(() => undefined);

  return { version };
}
