import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Short-lived download link for the 3D body scan attached to a booking slot.
 * Only the client on the slot and the studio that owns it may fetch it — the
 * file itself lives in the private `scans` bucket under the uploader's folder.
 */
export const getBookingScanUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ slotId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: slot } = await supabaseAdmin
      .from("studio_slots")
      .select("id, studio_id, booked_by, scan_path, scan_bucket, scan_name")
      .eq("id", data.slotId)
      .maybeSingle();
    if (!slot) return { ok: false as const, reason: "not_found" };
    if (slot.studio_id !== context.userId && slot.booked_by !== context.userId) {
      return { ok: false as const, reason: "forbidden" };
    }
    if (!slot.scan_path) return { ok: false as const, reason: "no_file" };

    const { data: signed, error } = await supabaseAdmin.storage
      .from(slot.scan_bucket ?? "scans")
      .createSignedUrl(slot.scan_path, 60 * 10);
    if (error || !signed?.signedUrl) {
      return { ok: false as const, reason: "sign_failed" };
    }
    return { ok: true as const, url: signed.signedUrl, name: slot.scan_name ?? "3d-scan" };
  });

/**
 * Tells the other side of a booking that the 3D scan status changed —
 * a file was delivered or removed. Uses each recipient's own channel
 * preferences (in-app, push, email).
 */
export const notifyScanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        slotId: z.string().uuid(),
        status: z.enum(["delivered", "removed"]),
        fileName: z.string().max(140).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyUser } = await import("@/lib/notify.server");

    const { data: slot } = await supabaseAdmin
      .from("studio_slots")
      .select("id, studio_id, booked_by, starts_at")
      .eq("id", data.slotId)
      .maybeSingle();
    if (!slot) return { ok: false as const, reason: "not_found" };
    if (slot.studio_id !== context.userId && slot.booked_by !== context.userId) {
      return { ok: false as const, reason: "forbidden" };
    }

    const when = slot.starts_at ? new Date(slot.starts_at).toLocaleString() : "your booking";
    const title =
      data.status === "delivered" ? "3D scan delivered" : "3D scan removed";
    const body =
      data.status === "delivered"
        ? `A 3D file${data.fileName ? ` (${data.fileName})` : ""} was added to the booking on ${when}.`
        : `The 3D file for the booking on ${when} was removed.`;

    const recipients = [slot.studio_id, slot.booked_by].filter(
      (id): id is string => Boolean(id) && id !== context.userId,
    );
    for (const id of recipients) {
      await notifyUser(id, {
        kind: "scan",
        title,
        body,
        url: "/bookings/activity",
        inApp: { kind: "booking", actorId: context.userId },
      }).catch(() => undefined);
    }
    return { ok: true as const, notified: recipients.length };
  });

/**
 * Short-lived download link for a file exchanged around a booking
 * (studio deliverables, stencils, Procreate/Illustrator exports).
 */
export const getBookingFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ fileId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: file } = await supabaseAdmin
      .from("booking_files")
      .select("id, slot_id, path, bucket, name")
      .eq("id", data.fileId)
      .maybeSingle();
    if (!file) return { ok: false as const, reason: "not_found" };

    const { data: slot } = await supabaseAdmin
      .from("studio_slots")
      .select("id, studio_id, booked_by")
      .eq("id", file.slot_id)
      .maybeSingle();
    if (!slot) return { ok: false as const, reason: "not_found" };
    if (slot.studio_id !== context.userId && slot.booked_by !== context.userId) {
      return { ok: false as const, reason: "forbidden" };
    }

    const { data: signed, error } = await supabaseAdmin.storage
      .from(file.bucket || "attachments")
      .createSignedUrl(file.path, 60 * 10);
    if (error || !signed?.signedUrl) return { ok: false as const, reason: "sign_failed" };
    return { ok: true as const, url: signed.signedUrl, name: file.name };
  });

/** Tells the other party that a booking file was shared with them. */
export const notifyBookingFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ slotId: z.string().uuid(), fileName: z.string().max(140) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyUser } = await import("@/lib/notify.server");

    const { data: slot } = await supabaseAdmin
      .from("studio_slots")
      .select("id, studio_id, booked_by, starts_at")
      .eq("id", data.slotId)
      .maybeSingle();
    if (!slot) return { ok: false as const, reason: "not_found" };
    if (slot.studio_id !== context.userId && slot.booked_by !== context.userId) {
      return { ok: false as const, reason: "forbidden" };
    }

    const when = slot.starts_at ? new Date(slot.starts_at).toLocaleString() : "your booking";
    const recipients = [slot.studio_id, slot.booked_by].filter(
      (id): id is string => Boolean(id) && id !== context.userId,
    );
    for (const id of recipients) {
      await notifyUser(id, {
        kind: "change",
        title: "New booking file",
        body: `${data.fileName} was shared for the booking on ${when}.`,
        url: "/bookings/activity",
        inApp: { kind: "booking", actorId: context.userId },
      }).catch(() => undefined);
    }
    return { ok: true as const, notified: recipients.length };
  });

/**
 * Fires a notification whenever the derived 3D pipeline stage of a booking
 * changes (Scan requested → In progress → Revised → Delivered). The last
 * announced stage is stored as a `scan_stage` entry in the booking timeline,
 * so the same stage is never announced twice.
 */
export const notifyScanStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        slotId: z.string().uuid(),
        stage: z.enum(["requested", "in_progress", "revised", "delivered"]),
        label: z.string().max(60),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deliverScanStage } = await import("@/lib/scanNotify.server");

    const { data: slot } = await supabaseAdmin
      .from("studio_slots")
      .select("id, studio_id, booked_by")
      .eq("id", data.slotId)
      .maybeSingle();
    if (!slot) return { ok: false as const, reason: "not_found" };
    if (slot.studio_id !== context.userId && slot.booked_by !== context.userId) {
      return { ok: false as const, reason: "forbidden" };
    }

    const { data: last } = await supabaseAdmin
      .from("slot_events")
      .select("note")
      .eq("slot_id", data.slotId)
      .eq("action", "scan_stage")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.note?.startsWith(data.stage)) {
      return { ok: true as const, changed: false, notified: 0 };
    }

    await supabaseAdmin.from("slot_events").insert({
      slot_id: data.slotId,
      actor_id: context.userId,
      actor_role: slot.studio_id === context.userId ? "studio" : "client",
      action: "scan_stage",
      note: `${data.stage} · ${data.label}`,
    });

    const res = await deliverScanStage({
      slotId: data.slotId,
      stage: data.stage,
      actorId: context.userId,
    });
    return {
      ok: true as const,
      changed: true,
      notified: res.ok ? res.notified : 0,
      failed: res.ok ? res.failed : 0,
    };
  });

/**
 * Re-sends a stage notification that previously failed, to one or both
 * parties. Logged as its own `notify_retry` entry in the booking timeline.
 */
export const retryScanStageNotify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        slotId: z.string().uuid(),
        stage: z.enum(["requested", "in_progress", "revised", "delivered"]),
        audience: z.enum(["client", "studio", "both"]).default("both"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deliverScanStage } = await import("@/lib/scanNotify.server");

    const { data: slot } = await supabaseAdmin
      .from("studio_slots")
      .select("id, studio_id, booked_by")
      .eq("id", data.slotId)
      .maybeSingle();
    if (!slot) return { ok: false as const, reason: "not_found" };
    if (slot.studio_id !== context.userId && slot.booked_by !== context.userId) {
      return { ok: false as const, reason: "forbidden" };
    }

    const res = await deliverScanStage({
      slotId: data.slotId,
      stage: data.stage,
      actorId: context.userId,
      audiences: data.audience === "both" ? undefined : [data.audience],
      retry: true,
    });
    if (!res.ok) return res;
    return { ok: true as const, notified: res.notified, failed: res.failed };
  });

