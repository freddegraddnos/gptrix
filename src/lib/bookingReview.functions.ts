import { publicSiteUrl } from "@/lib/publicOrigin";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function loadOwnBooking(bookingId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.artist_id !== userId) throw new Error("Booking not found.");
  return { booking, supabaseAdmin };
}

/** Resolve a notice link only for the studio that owns this booking. */
export const getStudioBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ bookingId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { booking } = await loadOwnBooking(data.bookingId, context.userId);
    return booking;
  });

/** Everything the studio needs to decide on a booking: who, what, and images. */
export const getBookingReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ bookingId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { booking, supabaseAdmin } = await loadOwnBooking(data.bookingId, context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, handle, contact_email, phone, avatar_url")
      .eq("id", booking.user_id)
      .maybeSingle();
    let email = profile?.contact_email ?? null;
    if (!email) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(booking.user_id);
      email = u?.user?.email ?? null;
    }
    const images: { url: string; name: string; label?: "with" | "without" | "own" }[] = [];
    if (booking.project_id) {
      const { data: p } = await supabaseAdmin
        .from("projects")
        .select("name, preview_url, base_photo_url, cover_url")
        .eq("id", booking.project_id)
        .maybeSingle();
      const withUrl = p?.preview_url ?? p?.cover_url;
      if (withUrl) images.push({ url: withUrl, name: p!.name, label: "with" });
      if (p?.base_photo_url) images.push({ url: p.base_photo_url, name: p.name, label: "without" });
    }
    if (booking.base_photo_url)
      images.push({ url: booking.base_photo_url, name: "photo", label: "own" });
    if (booking.slot_id) {
      const { data: files } = await supabaseAdmin
        .from("booking_files")
        .select("name, path, bucket")
        .eq("slot_id", booking.slot_id);
      for (const f of files ?? []) {
        if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(f.name)) continue;
        const { data: s } = await supabaseAdmin.storage
          .from(f.bucket)
          .createSignedUrl(f.path, 3600);
        if (s?.signedUrl) images.push({ url: s.signedUrl, name: f.name });
      }
    }
    if (booking.artist_project_id) {
      const { data: files } = await supabaseAdmin
        .from("artist_project_attachments")
        .select("file_name, storage_path, mime_type")
        .eq("project_id", booking.artist_project_id);
      for (const f of files ?? []) {
        const isImg =
          (f.mime_type ?? "").startsWith("image/") ||
          /\.(png|jpe?g|webp|gif|svg)$/i.test(f.file_name);
        if (!isImg) continue;
        const { data: s } = await supabaseAdmin.storage
          .from("attachments")
          .createSignedUrl(f.storage_path, 3600);
        if (s?.signedUrl) images.push({ url: s.signedUrl, name: f.file_name });
      }
    }
    return {
      customer: {
        name: profile?.display_name ?? profile?.handle ?? "Customer",
        email,
        phone: profile?.phone ?? null,
        avatar: profile?.avatar_url ?? null,
      },
      images,
      answers: Array.isArray(booking.intake_answers)
        ? (booking.intake_answers as { question: string; answer: string }[])
        : [],
    };
  });

/** Approve: set sessions × length and email the customer a calendar link. */
export const approveBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        bookingId: z.string().uuid(),
        sessions: z.number().int().min(1).max(20),
        minutesPerSession: z.number().int().min(30).max(720),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { booking, supabaseAdmin } = await loadOwnBooking(data.bookingId, context.userId);
    if (!booking.artist_id) throw new Error("This booking is not connected to a studio.");
    let projectId = booking.artist_project_id;
    if (!projectId) {
      const { data: created, error } = await supabaseAdmin
        .from("artist_client_projects")
        .insert({
          artist_id: booking.artist_id!,
          client_user_id: booking.user_id,
          title: booking.body_area ? `Tattoo · ${booking.body_area}` : "Tattoo booking",
          placement: booking.body_area,
          size_cm: booking.size_cm,
          description: booking.note,
          status: "approved",
          session_count: data.sessions,
          session_minutes: data.minutesPerSession,
        })
        .select("id")
        .single();
      if (error) throw error;
      projectId = created.id;
    } else {
      await supabaseAdmin
        .from("artist_client_projects")
        .update({
          session_count: data.sessions,
          session_minutes: data.minutesPerSession,
          status: "approved",
          latest_activity_at: new Date().toISOString(),
        })
        .eq("id", projectId);
    }
    await supabaseAdmin
      .from("bookings")
      .update({ status: "confirmed", artist_project_id: projectId, decline_reason: null })
      .eq("id", booking.id);
    // The approval e-mail below is the booking link; record it so the
    // workspace does not offer to send the same plan twice.
    await supabaseAdmin
      .from("artist_client_projects")
      .update({
        booking_link_sent_at: new Date().toISOString(),
        booking_link_session_count: data.sessions,
        booking_link_session_minutes: data.minutesPerSession,
      })
      .eq("id", projectId);

    const link = publicSiteUrl(`/requests/${projectId}?tab=sessions`);
    const hours = data.minutesPerSession / 60;
    const body = `${data.sessions} × ${Number.isInteger(hours) ? `${hours} h` : `${data.minutesPerSession} min`} — pick your times in the studio calendar.`;
    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser(booking.user_id, {
      kind: "confirmation",
      title: "Booking approved — pick your times",
      body,
      url: `/requests/${projectId}?tab=sessions`,
      inApp: { kind: "booking", actorId: context.userId },
      email: {
        template: "new-message",
        templateData: {
          senderName: booking.studio_name,
          preview: `${booking.studio_name} approved your booking. ${body}`,
          link,
        },
        idempotencyKey: `booking-approve-${booking.id}-${data.sessions}-${data.minutesPerSession}`,
      },
    }).catch(() => undefined);
    return { ok: true, projectId };
  });

const timeSuggestionSchema = z.object({
  bookingId: z.string().uuid(),
  sessions: z.number().int().min(1).max(20),
  minutesPerSession: z.number().int().min(30).max(720),
  suggestions: z.array(z.string().datetime()).min(1).max(4),
  note: z.string().trim().min(1).max(1000),
});

/** Approve the request and send exact proposed times plus a note to the client. */
export const approveBookingWithTimes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => timeSuggestionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { booking, supabaseAdmin } = await loadOwnBooking(data.bookingId, context.userId);
    if (!booking.artist_id) throw new Error("This booking is not connected to a studio.");
    let projectId = booking.artist_project_id;
    if (!projectId) {
      const { data: created, error } = await supabaseAdmin
        .from("artist_client_projects")
        .insert({
          artist_id: booking.artist_id,
          client_user_id: booking.user_id,
          title: booking.body_area ? `Tattoo · ${booking.body_area}` : "Tattoo booking",
          placement: booking.body_area,
          size_cm: booking.size_cm,
          description: booking.note,
          status: "approved",
          session_count: data.sessions,
          session_minutes: data.minutesPerSession,
        })
        .select("id")
        .single();
      if (error || !created) throw error ?? new Error("Could not approve the request.");
      projectId = created.id;
    } else {
      const { error } = await supabaseAdmin
        .from("artist_client_projects")
        .update({
          status: "approved",
          session_count: data.sessions,
          session_minutes: data.minutesPerSession,
          latest_activity_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      if (error) throw error;
    }
    const formatted = data.suggestions.map((value) =>
      new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
    );
    const message = `Suggested appointment times:\n${formatted.map((value) => `• ${value}`).join("\n")}\n\n${data.note}`;
    const { error: messageError } = await supabaseAdmin.from("artist_project_messages").insert({
      project_id: projectId,
      sender_id: context.userId,
      body: message,
    });
    if (messageError) throw messageError;
    await supabaseAdmin
      .from("bookings")
      .update({ status: "confirmed", artist_project_id: projectId, decline_reason: null })
      .eq("id", booking.id);
    const path = `/requests/${projectId}`;
    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser(booking.user_id, {
      kind: "change",
      title: "The studio suggested appointment times",
      body: `${booking.studio_name}: ${formatted.join(" · ")}`,
      url: path,
      inApp: { kind: "message", actorId: context.userId },
      email: {
        template: "new-message",
        templateData: {
          senderName: booking.studio_name,
          preview: message,
          link: publicSiteUrl(`${path}`),
        },
        idempotencyKey: `booking-times-${booking.id}-${data.suggestions.join("-")}`,
      },
    }).catch(() => undefined);
    return { ok: true, projectId };
  });

/** Decline with an optional explanation emailed to the customer. */
export const declineBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ bookingId: z.string().uuid(), comment: z.string().max(1000).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { booking, supabaseAdmin } = await loadOwnBooking(data.bookingId, context.userId);
    const reason = data.comment?.trim() || null;
    await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled", decline_reason: reason })
      .eq("id", booking.id);
    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser(booking.user_id, {
      kind: "change",
      title: "Booking declined",
      body: reason
        ? `${booking.studio_name}: ${reason}`
        : `${booking.studio_name} declined your booking.`,
      url: "/bookings",
      inApp: { kind: "booking", actorId: context.userId },
      email: {
        template: "booking-status",
        templateData: {
          studioName: booking.studio_name,
          status: "declined",
          date: booking.preferred_date,
          time: booking.preferred_time ?? undefined,
          reason: reason ?? undefined,
        },
        idempotencyKey: `booking-decline-${booking.id}`,
      },
    }).catch(() => undefined);
    return { ok: true };
  });
