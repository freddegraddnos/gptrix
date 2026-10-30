import { getPublicOrigin } from "@/lib/publicOrigin";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { studioBookingPath, studioBookingUrl } from "./studioBookingLinks";

const SITE = getPublicOrigin();


/**
 * Emails the studio when a client sends a booking request.
 * Called right after the booking row is created by the client.
 */
export const notifyBookingCreated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ bookingId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { sendBookingCreatedNotices } = await import("@/lib/bookingNotify.server");
    return sendBookingCreatedNotices(data.bookingId, context.userId);
  });

/**
 * Emails the client when the studio confirms or declines a booking.
 * Only the studio that owns the booking may trigger it.
 */
export const notifyBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        bookingId: z.string().uuid(),
        status: z.enum(["confirmed", "cancelled"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, user_id, artist_id, studio_name, preferred_date, preferred_time")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking) return { sent: false, reason: "not_found" };
    const isStudio = booking.artist_id === userId;
    const isClient = booking.user_id === userId;
    // The client may only trigger the cancellation notice for their own booking.
    if (!isStudio && !(isClient && data.status === "cancelled")) {
      return { sent: false, reason: "forbidden" };
    }
    const recipient = isStudio ? booking.user_id : booking.artist_id;
    if (!recipient) return { sent: false, reason: "no_studio_account" };

    try {
      const { notifyUser } = await import("@/lib/notify.server");
      const result = await notifyUser(recipient, {
        kind: data.status === "confirmed" ? "confirmation" : "change",
        title: data.status === "confirmed" ? "Appointment confirmed" : "Booking update",
        body: `${booking.studio_name} · ${booking.preferred_date}${booking.preferred_time ? ` ${booking.preferred_time}` : ""}`,
        url: isStudio ? "/bookings" : studioBookingPath(booking.id),
        inApp: { kind: "booking", actorId: userId },
        email: {
          template: "booking-status",
          templateData: {
            studioName: booking.studio_name,
            status: data.status === "confirmed" ? "confirmed" : isClient ? "cancelled" : "declined",
            date: booking.preferred_date,
            time: booking.preferred_time ?? "",
            link: isStudio ? `${SITE}/bookings` : studioBookingUrl(booking.id),
          },
          idempotencyKey: `booking-status-${booking.id}-${data.status}-${recipient}`,
        },
      });
      return { sent: result.emails > 0 || result.push > 0, ...result };

    } catch (err) {
      console.error("[bookings] status notification failed", err);
      return { sent: false, reason: "send_failed" };
    }
  });

/**
 * Emails the client and the studio when a calendar slot is booked, cancelled
 * or moved. The caller must be the client on the slot or the studio owner.
 */
export const notifySlotBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        slotId: z.string().uuid(),
        action: z.enum([
          "requested",
          "declined",
          "booked",
          "cancelled",
          "rescheduled",
          "proposed",
          "proposal_accepted",
          "proposal_declined",
        ]),
        reason: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: slot } = await supabaseAdmin
      .from("studio_slots")
      .select(
        "id, studio_id, booked_by, starts_at, duration_minutes, member_id, proposed_starts_at, decline_reason",
      )
      .eq("id", data.slotId)
      .maybeSingle();
    if (!slot) return { sent: false, reason: "not_found" };
    if (slot.studio_id !== userId && slot.booked_by !== userId) {
      return { sent: false, reason: "forbidden" };
    }

    const { data: studio } = await supabaseAdmin
      .from("artist_profiles")
      .select("studio_name")
      .eq("user_id", slot.studio_id)
      .maybeSingle();

    const clientId = slot.booked_by ?? userId;
    const targets = Array.from(new Set([clientId, slot.studio_id]));

    const proposed = slot.proposed_starts_at ? new Date(slot.proposed_starts_at) : null;
    const when =
      data.action === "proposed" && proposed ? proposed : new Date(slot.starts_at);
    const reason = data.reason ?? slot.decline_reason ?? undefined;
    const status =
      data.action === "booked" || data.action === "proposal_accepted"
        ? "confirmed"
        : data.action === "requested"
          ? "requested"
          : data.action === "proposed"
            ? "proposed"
            : data.action === "declined" || data.action === "proposal_declined"
              ? "declined"
              : data.action === "cancelled"
                ? "cancelled"
                : "moved";

    try {
      const { notifyUser } = await import("@/lib/notify.server");
      for (const target of targets) {
        const forStudio = target === slot.studio_id;
        await notifyUser(target, {
          kind:
            data.action === "booked" || data.action === "proposal_accepted"
              ? "confirmation"
              : "change",
          title:
            data.action === "proposed"
              ? forStudio
                ? "New time proposed to the client"
                : "The studio proposed a new time"
              : data.action === "proposal_accepted"
                ? "Appointment confirmed — new time accepted"
                : data.action === "proposal_declined"
                  ? "The proposed time was declined"
                  : data.action === "booked"
              ? "Appointment confirmed"
              : data.action === "requested"
                ? forStudio
                  ? "New booking request — approval needed"
                  : "Request sent — awaiting studio approval"
                : data.action === "declined"
                  ? "Booking request declined"
                  : data.action === "cancelled"
                    ? "Appointment cancelled"
                    : "Appointment moved",
          body: `${studio?.studio_name ?? "The studio"} · ${when
            .toISOString()
            .slice(0, 16)
            .replace("T", " ")}${reason ? ` · ${reason}` : ""}`,
          url: forStudio ? "/artists/dashboard" : "/bookings",
          inApp: { kind: "booking", actorId: userId },

          email: {
            template: "booking-status",
            templateData: {
              studioName: studio?.studio_name ?? "The studio",
              status,
              date: when.toISOString().slice(0, 10),
              time: when.toISOString().slice(11, 16),
              reason,
              link: forStudio ? `${SITE}/artists/dashboard` : `${SITE}/bookings`,
            },
            idempotencyKey: `slot-${slot.id}-${data.action}-${target}`,
          },
        });
      }
      return { sent: true };
    } catch (err) {
      console.error("[bookings] slot notification failed", err);
      return { sent: false, reason: "send_failed" };
    }
  });
