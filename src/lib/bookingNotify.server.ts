import { getPublicOrigin } from "@/lib/publicOrigin";
import { studioBookingPath, studioBookingUrl } from "./studioBookingLinks";

const SITE = getPublicOrigin();

/**
 * Sends every notice for a new booking request: studio (in-app/email + SMS
 * when enabled), admin statistics copy, and the client's confirmation.
 * Shared by the website flow and the AI-agent (MCP) booking tool.
 */
export async function sendBookingCreatedNotices(
  bookingId: string,
  userId: string,
  via: "web" | "agent" = "web",
) {
  const data = { bookingId };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, user_id, artist_id, studio_name, preferred_date, preferred_time, body_area, size_cm, note, intake_answers, base_photo_url",
    )
    .eq("id", data.bookingId)
    .maybeSingle();
  if (!booking || booking.user_id !== userId) return { sent: false, reason: "not_found" };

  const { data: clientProfile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", booking.user_id)
    .maybeSingle();

  const { data: studioForm } = booking.artist_id
    ? await supabaseAdmin
        .from("artist_profiles")
        .select("booking_greeting")
        .eq("user_id", booking.artist_id)
        .maybeSingle()
    : { data: null };
  const answers = Array.isArray(booking.intake_answers)
    ? (booking.intake_answers as { question: string; answer: string }[])
    : [];

  const studioTemplateData = {
    studioName: booking.studio_name,
    clientName: clientProfile?.display_name ?? "A client",
    date: booking.preferred_date,
    time: booking.preferred_time ?? "",
    bodyArea: booking.body_area ?? "",
    sizeCm: booking.size_cm != null ? String(booking.size_cm) : "",
    note: booking.note ?? "",
    link: studioBookingUrl(booking.id),
    answers,
    hasCustomerPhoto: Boolean(booking.base_photo_url),
    photoUrl: booking.base_photo_url ?? undefined,
  };

  try {
    const { notifyUser } = await import("@/lib/notify.server");
    // The studio only gets an email when it has an InkSimulator account.
    const result = booking.artist_id
      ? await notifyUser(booking.artist_id, {
          kind: "confirmation",
          title: "New booking request",
          body: `${clientProfile?.display_name ?? "A client"} · ${booking.preferred_date}${booking.preferred_time ? ` ${booking.preferred_time}` : ""}`,
          url: studioBookingPath(booking.id),
          inApp: { kind: "booking", actorId: booking.user_id },
          email: {
            template: "booking-request",
            templateData: studioTemplateData,
            idempotencyKey: `booking-request-${booking.id}`,
          },
        })
      : { emails: 0, push: 0 };

    if (booking.artist_id) {
      const { data: st } = await supabaseAdmin
        .from("artist_profiles")
        .select("notify_phone, notify_sms_enabled")
        .eq("user_id", booking.artist_id)
        .maybeSingle();
      if (st?.notify_sms_enabled && st.notify_phone) {
        const { sendSms } = await import("@/lib/sms.server");
        await sendSms(
          st.notify_phone,
          `Ny bokningsförfrågan${via === "agent" ? " (via AI-assistent)" : ""} från ${clientProfile?.display_name ?? "en kund"} – ${booking.preferred_date}. Öppna: ${studioBookingUrl(booking.id)}`,
        );
      }
    }

    // Statistics copy to the InkSimulator admin inbox.
    const { sendAdminRequestCopy } = await import("@/lib/adminCopy.server");
    await sendAdminRequestCopy(
      "booking-request",
      { ...studioTemplateData, photoUrl: undefined },
      `booking-request-${booking.id}`,
    );

    // The person who booked gets their own confirmation + calendar link,
    // and the reminder job takes care of the day-before nudge.
    const { googleCalendarUrl, zonedDateTime } = await import("@/lib/ics");
    const calendarLink = googleCalendarUrl({
      id: booking.id,
      title: `Tattoo appointment — ${booking.studio_name}`,
      description: "Booked with InkSimulator",
      start: zonedDateTime(booking.preferred_date, booking.preferred_time),
      durationMinutes: 60,
      url: `${SITE}/bookings`,
    });
    const clientResult = await notifyUser(booking.user_id, {
      kind: "confirmation",
      title: "Booking request sent",
      body: `${booking.studio_name} · ${booking.preferred_date}${booking.preferred_time ? ` ${booking.preferred_time}` : ""}`,
      url: "/bookings",
      email: {
        template: "booking-received",
        templateData: {
          studioName: booking.studio_name,
          date: booking.preferred_date,
          time: booking.preferred_time ?? "",
          bodyArea: booking.body_area ?? "",
          sizeCm: booking.size_cm != null ? String(booking.size_cm) : "",
          photoUrl: booking.base_photo_url ?? undefined,
          link: `${SITE}/bookings`,
          calendarLink,
          greeting: studioForm?.booking_greeting ?? undefined,
          answers,
        },
        idempotencyKey: `booking-received-${booking.id}`,
      },
    });

    return {
      sent: clientResult.emails > 0 || result.emails > 0 || result.push > 0,
      studio: { emails: result.emails, push: result.push },
      client: { emails: clientResult.emails, push: clientResult.push },
    };
  } catch (err) {
    console.error("[bookings] request notification failed", err);
    return { sent: false, reason: "send_failed" };
  }
}
