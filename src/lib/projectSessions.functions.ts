import { publicSiteUrl } from "@/lib/publicOrigin";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAgeVerified } from "@/lib/ageVerification.functions";

const sessionSettingsSchema = z.object({
  projectId: z.string().uuid(),
  sessionCount: z.number().int().min(1).max(20),
  sessionMinutes: z.number().int().min(30).max(720),
  sessionPlan: z.array(z.number().int().min(30).max(720)).max(20).nullable().optional(),
}).refine((d) => !d.sessionPlan || d.sessionPlan.length === d.sessionCount, { message: "One length per session." });

const bookSchema = z.object({
  projectId: z.string().uuid(),
  slotId: z.string().uuid(),
});

/** The studio decides how many sessions the tattoo needs and how long each is. */
export const setProjectSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sessionSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id, artist_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    const { data: allowed } = await context.supabase.rpc("is_studio_staff", {
      _studio: project.artist_id,
      _user: context.userId,
    });
    if (!allowed) throw new Error("Only the studio can change the sessions.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("artist_client_projects")
      .update({
        session_count: data.sessionCount,
        session_minutes: data.sessionMinutes,
        session_plan: data.sessionPlan && new Set(data.sessionPlan).size > 1 ? data.sessionPlan : null,
        latest_activity_at: new Date().toISOString(),
      })
      .eq("id", project.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * The studio sends the customer a link to the calendar where they pick the
 * day and time for each session themselves.
 */
export const sendSessionBookingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid(), allowWithoutTimes: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id, artist_id, client_user_id, session_count, session_minutes, booking_link_sent_at, booking_link_session_count, booking_link_session_minutes, booking_link_sending_at, session_plan, booking_link_session_plan")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    const { data: allowed } = await context.supabase.rpc("is_studio_staff", {
      _studio: project.artist_id,
      _user: context.userId,
    });
    if (!allowed) throw new Error("Only the studio can send the booking link.");
    const link = publicSiteUrl(`/requests/${project.id}?tab=sessions`);
    const { bookingLinkState, sendDecision, SEND_LOCK_MS, planMinutes, planKey, unfitSessions, planSummary } = await import("@/lib/sessionPlan");
    const plan = planMinutes(project.session_count, project.session_minutes, project.session_plan);
    const sentPlan = planMinutes(project.booking_link_session_count ?? 0, project.booking_link_session_minutes ?? 0, project.booking_link_session_plan);
    let state = bookingLinkState(
      { sentAt: project.booking_link_sent_at, count: project.booking_link_session_count, minutes: project.booking_link_session_minutes },
      project.session_count,
      project.session_minutes,
    );
    if (state === "already_sent_same" && planKey(sentPlan) !== planKey(plan)) state = "sent_with_other_plan";
    if (state === "already_sent_same") {
      return { ok: true, alreadySent: true, sentAt: project.booking_link_sent_at, link, openSlots: 0 };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: slotRows } = await supabaseAdmin
      .from("studio_slots")
      .select("duration_minutes")
      .eq("studio_id", project.artist_id)
      .eq("status", "open")
      .gte("starts_at", new Date().toISOString());
    const unfit = unfitSessions(plan, (slotRows ?? []).map((s) => s.duration_minutes));
    const matching = unfit.length === 0 ? (slotRows ?? []).filter((s) => (s.duration_minutes ?? 0) >= Math.min(...plan)).length : 0;

    const decision = sendDecision({
      hasCustomer: Boolean(project.client_user_id),
      matchingSlots: matching,
      allowWithoutTimes: Boolean(data.allowWithoutTimes),
      linkState: state,
      sendingSince: project.booking_link_sending_at,
      now: Date.now(),
    });
    if (!decision.ok) {
      if (decision.reason === "no_customer") throw new Error("This request has no customer account yet.");
      if (decision.reason === "in_progress") throw new Error("The booking link is already being sent.");
      throw new Error("There are no published free times that fit a session. Add free times first.");
    }

    // Claim the send atomically: a double click or retry finds the lock taken.
    const staleBefore = new Date(Date.now() - SEND_LOCK_MS).toISOString();
    const { data: claimed } = await supabaseAdmin
      .from("artist_client_projects")
      .update({ booking_link_sending_at: new Date().toISOString() })
      .eq("id", project.id)
      .or(`booking_link_sending_at.is.null,booking_link_sending_at.lt.${staleBefore}`)
      .select("id")
      .maybeSingle();
    if (!claimed) throw new Error("The booking link is already being sent.");

    try {
      const { data: studio } = await supabaseAdmin
        .from("artist_profiles")
        .select("studio_name")
        .eq("user_id", project.artist_id)
        .maybeSingle();
      const body = new Set(plan).size > 1
        ? `${plan.length} sessions · ${planSummary(plan).text} — pick your times.`
        : `${project.session_count} session${project.session_count > 1 ? "s" : ""} · ${project.session_minutes} min each — pick your times.`;
      const { notifyUser } = await import("@/lib/notify.server");
      await notifyUser(project.client_user_id!, {
        kind: "change",
        title: "Pick your session times",
        body,
        url: `/requests/${project.id}?tab=sessions`,
        inApp: { kind: "booking", actorId: project.artist_id },
        email: {
          template: "new-message",
          templateData: {
            senderName: studio?.studio_name ?? "Your studio",
            preview: `${body} Open the calendar to choose day and time.`,
            link,
          },
          idempotencyKey: `session-link-${project.id}-${planKey(plan)}`,
        },
      }).catch(() => undefined);

      const sentAt = new Date().toISOString();
      await supabaseAdmin
        .from("artist_client_projects")
        .update({
          latest_activity_at: sentAt,
          booking_link_sent_at: sentAt,
          booking_link_session_count: project.session_count,
          booking_link_session_minutes: project.session_minutes,
          booking_link_session_plan: project.session_plan,
          booking_link_sending_at: null,
        })
        .eq("id", project.id);
      return { ok: true, alreadySent: false, sentAt, link, openSlots: matching };
    } catch (e) {
      await supabaseAdmin.from("artist_client_projects").update({ booking_link_sending_at: null }).eq("id", project.id);
      throw e;
    }
  });

/** Customer: no free time fits — ask the studio for more. Sent once until the studio answers. */
export const requestMoreTimes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid(), message: z.string().trim().min(1).max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id, artist_id, client_user_id, session_minutes, more_times_requested_at")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    if (project.client_user_id !== context.userId) throw new Error("Only the customer can ask for more times.");
    if (project.more_times_requested_at) return { ok: true, alreadyRequested: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: claimed } = await supabaseAdmin
      .from("artist_client_projects")
      .update({ more_times_requested_at: now, more_times_request_note: data.message, more_times_notified_at: null, latest_activity_at: now })
      .eq("id", project.id)
      .is("more_times_requested_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return { ok: true, alreadyRequested: true };
    // Goes into the case conversation, which the assigned artist and the studio inbox both read.
    await supabaseAdmin.from("artist_project_messages").insert({ project_id: project.id, sender_id: context.userId, body: data.message }).then(() => undefined, () => undefined);
    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser(project.artist_id, {
      kind: "change",
      title: "Customer needs more booking times",
      body: `${project.session_minutes} min per session`,
      url: `/artists/requests/${project.id}?tab=sessions`,
      inApp: { kind: "booking", actorId: context.userId },
    }).catch(() => undefined);
    return { ok: true, alreadyRequested: false };
  });

/** Studio: tell the customer new times are published. Once per customer request. */
export const notifyCustomerTimesAdded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id, artist_id, client_user_id, more_times_requested_at, more_times_notified_at")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    const { data: allowed } = await context.supabase.rpc("is_studio_staff", { _studio: project.artist_id, _user: context.userId });
    if (!allowed) throw new Error("Only the studio can do this.");
    if (!project.more_times_requested_at || !project.client_user_id) throw new Error("The customer has not asked for more times.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claimed } = await supabaseAdmin
      .from("artist_client_projects")
      .update({ more_times_requested_at: null, more_times_notified_at: new Date().toISOString() })
      .eq("id", project.id)
      .not("more_times_requested_at", "is", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return { ok: true, alreadyNotified: true };
    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser(project.client_user_id, {
      kind: "change",
      title: "New booking times are available",
      body: "Open your booking to pick a time.",
      url: `/requests/${project.id}?tab=sessions`,
      inApp: { kind: "booking", actorId: project.artist_id },
    }).catch(() => undefined);
    return { ok: true, alreadyNotified: false };
  });

/**
 * Everything the studio must see before sending a booking link: recipient,
 * artist, deposit rule effect, age check state and how many free times fit
 * the planned length. Read-only and limited to the project's own studio.
 */
export const getSessionPlanContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id, artist_id, assigned_artist_id, session_count, session_minutes, session_plan, client_user_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    const { data: allowed } = await context.supabase.rpc("is_studio_staff", {
      _studio: project.artist_id,
      _user: context.userId,
    });
    if (!allowed) throw new Error("Only the studio can see this.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [studio, artist, deposit, age, slots] = await Promise.all([
      supabaseAdmin.from("artist_profiles").select("require_deposit_for_confirmation").eq("user_id", project.artist_id).maybeSingle(),
      project.assigned_artist_id
        ? supabaseAdmin.from("studio_artists").select("name").eq("id", project.assigned_artist_id).eq("studio_id", project.artist_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from("project_deposits").select("status, amount_ore").eq("project_id", project.id).eq("kind", "deposit").neq("status", "cancelled").maybeSingle(),
      supabaseAdmin.from("artist_project_age_verifications").select("status, min_age").eq("project_id", project.id).maybeSingle(),
      supabaseAdmin.from("studio_slots").select("duration_minutes").eq("studio_id", project.artist_id).eq("status", "open").gte("starts_at", new Date().toISOString()),
    ]);
    const open = slots.data ?? [];
    // Real recipient: the linked customer account and its sign-in e-mail.
    let recipientEmail: string | null = null;
    if (project.client_user_id) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(project.client_user_id);
      recipientEmail = u?.user?.email ?? null;
    }
    return {
      requireDeposit: Boolean(studio.data?.require_deposit_for_confirmation),
      deposit: deposit.data ? { status: deposit.data.status as string, amountOre: deposit.data.amount_ore as number } : null,
      artistName: (artist.data as { name: string } | null)?.name ?? null,
      age: age.data ? { status: age.data.status as string, minAge: age.data.min_age as number } : null,
      hasCustomer: Boolean(project.client_user_id),
      recipientEmail,
      openSlots: open.length,
      openSlotsMatching: open.filter((s) => (s.duration_minutes ?? 0) >= project.session_minutes).length,
      // Sessions (1-based) that no published free time can hold, given each session's own length.
      unfitSessions: (await import("@/lib/sessionPlan")).unfitSessions(
        (await import("@/lib/sessionPlan")).planMinutes(project.session_count, project.session_minutes, project.session_plan),
        open.map((s) => s.duration_minutes),
      ).map((i) => i + 1),
    };
  });

/**
 * Pulls the studio's Google Calendar so busy times are blocked before the
 * customer sees (or takes) a slot. Only the two parties of the project can
 * trigger it, and it never exposes what the busy events are.
 */
async function refreshStudioBusy(studioId: string) {
  try {
    const { syncGoogleBusy } = await import("@/lib/studioCalendar.server");
    await syncGoogleBusy(studioId);
  } catch {
    // No Google link, or Google is down: the InkSimulator slots still apply.
  }
}

export const refreshProjectAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: party } = await context.supabase.rpc("is_artist_project_party", {
      _project: data.projectId,
      _user: context.userId,
    });
    if (!party) throw new Error("Not your project.");
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("artist_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    await refreshStudioBusy(project.artist_id);
    return { ok: true };
  });


/**
 * The customer picks one of the studio's free times for a session. Only
 * possible once the studio approved a sketch, and only up to the number of
 * sessions the studio set.
 */
export const bookProjectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bookSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id, artist_id, client_user_id, status, placement, size_cm, session_count, session_minutes, session_plan")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    if (project.client_user_id !== context.userId) {
      throw new Error("Only the customer can pick a time for this project.");
    }
    if (!["approved", "booked"].includes(project.status)) {
      throw new Error("The design has to be approved before you can pick a time.");
    }
    await assertAgeVerified(project.id);

    // Re-check Google right before taking the slot, so a time that got busy
    // in the studio's own calendar can never be booked here.
    await refreshStudioBusy(project.artist_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count: alreadyBooked } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("artist_project_id", project.id)
      .neq("status", "cancelled");
    const bookedCount = alreadyBooked ?? 0;
    if (bookedCount >= project.session_count) {
      throw new Error("All sessions for this project are already booked.");
    }

    // The free time must be long enough to hold one planned session.
    const { data: candidate } = await supabaseAdmin
      .from("studio_slots")
      .select("duration_minutes")
      .eq("id", data.slotId)
      .eq("studio_id", project.artist_id)
      .maybeSingle();
    if (!candidate) throw new Error("That time is not available.");
    const { sessionMinutesAt } = await import("@/lib/sessionPlan");
    const needMinutes = sessionMinutesAt(bookedCount, project.session_count, project.session_minutes, project.session_plan);
    if ((candidate.duration_minutes ?? 0) < needMinutes) {
      throw new Error("That time is too short for your session. Pick a longer time.");
    }

    // Take the slot only while it is still free — guards against two people
    // picking the same time at once.
    const { data: slot, error: slotError } = await supabaseAdmin
      .from("studio_slots")
      .update({
        status: "booked",
        booked_by: context.userId,
        booked_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.slotId)
      .eq("studio_id", project.artist_id)
      .eq("status", "open")
      .gte("duration_minutes", needMinutes)
      .select("id, starts_at, duration_minutes")
      .maybeSingle();
    if (slotError) throw slotError;
    if (!slot) throw new Error("That time was just taken. Pick another one.");

    const { data: studio } = await supabaseAdmin
      .from("artist_profiles")
      .select("studio_name, address, require_deposit_for_confirmation")
      .eq("user_id", project.artist_id)
      .maybeSingle();
    const { data: deposit } = await supabaseAdmin
      .from("project_deposits")
      .select("status")
      .eq("project_id", project.id)
      .neq("status", "cancelled")
      .maybeSingle();
    const awaitingDeposit = Boolean(
      studio?.require_deposit_for_confirmation && deposit?.status !== "paid",
    );

    const starts = new Date(slot.starts_at);
    const date = `${starts.getFullYear()}-${String(starts.getMonth() + 1).padStart(2, "0")}-${String(starts.getDate()).padStart(2, "0")}`;
    const time = `${String(starts.getHours()).padStart(2, "0")}:${String(starts.getMinutes()).padStart(2, "0")}`;

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        user_id: context.userId,
        artist_id: project.artist_id,
        artist_project_id: project.id,
        slot_id: slot.id,
        slot_starts_at: slot.starts_at,
        session_number: bookedCount + 1,
        studio_name: studio?.studio_name ?? "Tattoo studio",
        studio_address: studio?.address ?? null,
        preferred_date: date,
        preferred_time: time,
        duration_minutes: slot.duration_minutes,
        body_area: project.placement,
        size_cm: project.size_cm,
        status: awaitingDeposit ? "awaiting_deposit" : "confirmed",
      })
      .select("id")
      .single();
    if (error || !booking) throw error ?? new Error("Could not save the session.");

    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser(project.artist_id, {
      kind: "confirmation",
      title: "A customer picked a time",
      body: `Session ${bookedCount + 1} of ${project.session_count} · ${date} ${time}`,
      url: `/artists/requests/${project.id}`,
      inApp: { kind: "booking", actorId: context.userId },
      email: {
        template: "booking-status",
        templateData: {
          studioName: studio?.studio_name ?? "Your studio",
          status: awaitingDeposit ? "awaiting deposit" : "confirmed",
          date,
          time,
          link: publicSiteUrl(`/artists/requests/${project.id}`),
        },
        idempotencyKey: `project-session-studio-${booking.id}`,
      },
    }).catch(() => undefined);

    await notifyUser(context.userId, {
      kind: "confirmation",
      title: awaitingDeposit ? "Time held — deposit needed" : "Session booked",
      body: `${studio?.studio_name ?? "Your studio"} · ${date} ${time}`,
      url: `/requests/${project.id}`,
      inApp: { kind: "booking", actorId: project.artist_id },
      email: {
        template: "booking-status",
        templateData: {
          studioName: studio?.studio_name ?? "Your studio",
          status: awaitingDeposit ? "awaiting deposit" : "confirmed",
          date,
          time,
          link: publicSiteUrl(`/requests/${project.id}`),
        },
        idempotencyKey: `project-session-client-${booking.id}`,
      },
    }).catch(() => undefined);

    try {
      const { pushBookingToGoogle } = await import("@/lib/studioCalendar.server");
      await pushBookingToGoogle(project.artist_id, {
        id: booking.id,
        startsAt: slot.starts_at,
        durationMinutes: slot.duration_minutes,
        summary: `Tattoo session ${bookedCount + 1}/${project.session_count}`,
        description: `InkSimulator project ${project.id}`,
      });
    } catch {
      // A Google sync problem must never break the booking itself.
    }

    return {
      id: booking.id,
      sessionNumber: bookedCount + 1,
      awaitingDeposit,
      remaining: project.session_count - (bookedCount + 1),
    };
  });

const proposeSchema = z.object({
  projectId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeWindow: z.enum(["morning", "afternoon", "evening"]),
  note: z.string().trim().max(280).optional(),
});

const WINDOW_LABEL: Record<string, string> = {
  morning: "Morning (9–12)",
  afternoon: "Afternoon (12–17)",
  evening: "Evening (17–20)",
};

/**
 * The customer proposes a day and rough time when the studio has not opened
 * any free slots (or none fit). Stored as a proposal row and echoed into the
 * project conversation; the studio answers from the project view.
 */
export const proposeProjectTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => proposeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id, artist_id, client_user_id, status, session_count")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    if (project.client_user_id !== context.userId) {
      throw new Error("Only the customer can propose a time for this project.");
    }
    if (!["approved", "booked"].includes(project.status)) {
      throw new Error("The design has to be approved before you can propose a time.");
    }
    const day = new Date(`${data.date}T12:00:00`);
    if (Number.isNaN(day.getTime()) || day.getTime() < Date.now() - 86_400_000) {
      throw new Error("Pick a date in the future.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count: alreadyBooked } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("artist_project_id", project.id)
      .neq("status", "cancelled");
    if ((alreadyBooked ?? 0) >= project.session_count) {
      throw new Error("All sessions for this project are already booked.");
    }

    const { count: openCount } = await supabaseAdmin
      .from("project_time_proposals")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("status", "open");
    if ((openCount ?? 0) >= 3) {
      throw new Error("You already have 3 open proposals — wait for the studio to answer.");
    }

    const { data: proposal, error } = await supabaseAdmin
      .from("project_time_proposals")
      .insert({
        project_id: project.id,
        proposed_by: context.userId,
        proposed_date: data.date,
        time_window: data.timeWindow,
        note: data.note || null,
      })
      .select("id")
      .single();
    if (error || !proposal) throw error ?? new Error("Could not save the proposal.");

    const summary = `Proposed a time: ${data.date} · ${WINDOW_LABEL[data.timeWindow]}${data.note ? ` — “${data.note}”` : ""}`;
    try {
      await supabaseAdmin
        .from("artist_project_messages")
        .insert({ project_id: project.id, sender_id: context.userId, body: summary });
    } catch {
      // A conversation echo problem must never break the proposal itself.
    }

    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser(project.artist_id, {
      kind: "confirmation",
      title: "The client proposed a time",
      body: `${data.date} · ${WINDOW_LABEL[data.timeWindow]}`,
      url: `/artists/requests/${project.id}`,
      inApp: { kind: "booking", actorId: context.userId },
      email: {
        template: "booking-status",
        templateData: {
          studioName: "Your studio",
          status: "a new time proposal",
          date: data.date,
          time: WINDOW_LABEL[data.timeWindow],
          link: publicSiteUrl(`/artists/requests/${project.id}`),
        },
        idempotencyKey: `time-proposal-${proposal.id}`,
      },
    }).catch(() => undefined);

    return { id: proposal.id };
  });

const respondSchema = z.object({
  proposalId: z.string().uuid(),
  accept: z.boolean(),
  /** Exact start (ISO) chosen by the studio when accepting. */
  startsAt: z.string().datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().min(30).max(720).optional(),
});

/**
 * The studio answers a time proposal. On accept the slot is created and
 * booked for the customer in one step, following the same deposit rules as
 * a normal booking.
 */
export const respondTimeProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => respondSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: proposal } = await context.supabase
      .from("project_time_proposals")
      .select("id, project_id, proposed_by, proposed_date, time_window, status")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (!proposal) throw new Error("Proposal not found.");
    if (proposal.status !== "open") throw new Error("This proposal is already answered.");

    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id, artist_id, client_user_id, placement, size_cm, session_count, session_minutes, session_plan")
      .eq("id", proposal.project_id)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    const { data: allowed } = await context.supabase.rpc("is_studio_staff", {
      _studio: project.artist_id,
      _user: context.userId,
    });
    if (!allowed) throw new Error("Only the studio can answer proposals.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyUser } = await import("@/lib/notify.server");

    if (!data.accept) {
      const { error } = await supabaseAdmin
        .from("project_time_proposals")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", proposal.id)
        .eq("status", "open");
      if (error) throw error;
      await notifyUser(proposal.proposed_by, {
        kind: "change",
        title: "The studio couldn't take that time",
        body: `${proposal.proposed_date} · ${WINDOW_LABEL[proposal.time_window]}. Pick another day or wait for new times.`,
        url: `/requests/${project.id}`,
        inApp: { kind: "booking", actorId: context.userId },
        email: {
          template: "booking-status",
          templateData: {
            studioName: "Your studio",
            status: "declined your proposed time",
            date: proposal.proposed_date,
            time: WINDOW_LABEL[proposal.time_window],
            link: publicSiteUrl(`/requests/${project.id}`),
          },
          idempotencyKey: `time-proposal-declined-${proposal.id}`,
        },
      }).catch(() => undefined);
      return { accepted: false };
    }

    if (!data.startsAt) throw new Error("Pick the exact start time.");
    const starts = new Date(data.startsAt);
    if (Number.isNaN(starts.getTime()) || starts.getTime() < Date.now()) {
      throw new Error("Pick a time in the future.");
    }
    if (!project.client_user_id) throw new Error("The project has no linked customer account.");
    await assertAgeVerified(project.id);
    const { count: alreadyBooked } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("artist_project_id", project.id)
      .neq("status", "cancelled");
    const bookedCount = alreadyBooked ?? 0;
    if (bookedCount >= project.session_count) {
      throw new Error("All sessions for this project are already booked.");
    }
    const { sessionMinutesAt } = await import("@/lib/sessionPlan");
    const duration = data.durationMinutes ?? sessionMinutesAt(bookedCount, project.session_count, project.session_minutes, project.session_plan);

    // Create the slot already booked by the customer — same end state as a
    // customer-picked slot, so the calendar and reminders behave identically.
    const { data: slot, error: slotError } = await supabaseAdmin
      .from("studio_slots")
      .insert({
        studio_id: project.artist_id,
        starts_at: starts.toISOString(),
        duration_minutes: duration,
        status: "booked",
        booked_by: project.client_user_id,
        booked_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      })
      .select("id, starts_at, duration_minutes")
      .single();
    if (slotError || !slot) throw slotError ?? new Error("Could not create the time.");

    const { data: studio } = await supabaseAdmin
      .from("artist_profiles")
      .select("studio_name, address, require_deposit_for_confirmation")
      .eq("user_id", project.artist_id)
      .maybeSingle();
    const { data: deposit } = await supabaseAdmin
      .from("project_deposits")
      .select("status")
      .eq("project_id", project.id)
      .neq("status", "cancelled")
      .maybeSingle();
    const awaitingDeposit = Boolean(
      studio?.require_deposit_for_confirmation && deposit?.status !== "paid",
    );

    const date = `${starts.getFullYear()}-${String(starts.getMonth() + 1).padStart(2, "0")}-${String(starts.getDate()).padStart(2, "0")}`;
    const time = `${String(starts.getHours()).padStart(2, "0")}:${String(starts.getMinutes()).padStart(2, "0")}`;

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        user_id: project.client_user_id,
        artist_id: project.artist_id,
        artist_project_id: project.id,
        slot_id: slot.id,
        slot_starts_at: slot.starts_at,
        session_number: bookedCount + 1,
        studio_name: studio?.studio_name ?? "Tattoo studio",
        studio_address: studio?.address ?? null,
        preferred_date: date,
        preferred_time: time,
        duration_minutes: slot.duration_minutes,
        body_area: project.placement,
        size_cm: project.size_cm,
        status: awaitingDeposit ? "awaiting_deposit" : "confirmed",
      })
      .select("id")
      .single();
    if (error || !booking) throw error ?? new Error("Could not save the session.");

    const { error: updError } = await supabaseAdmin
      .from("project_time_proposals")
      .update({ status: "accepted", responded_at: new Date().toISOString(), booking_id: booking.id })
      .eq("id", proposal.id)
      .eq("status", "open");
    if (updError) throw updError;

    await notifyUser(project.client_user_id, {
      kind: "confirmation",
      title: awaitingDeposit ? "Time held — deposit needed" : "The studio accepted your time",
      body: `${studio?.studio_name ?? "Your studio"} · ${date} ${time}`,
      url: `/requests/${project.id}`,
      inApp: { kind: "booking", actorId: context.userId },
      email: {
        template: "booking-status",
        templateData: {
          studioName: studio?.studio_name ?? "Your studio",
          status: awaitingDeposit ? "awaiting deposit" : "confirmed",
          date,
          time,
          link: publicSiteUrl(`/requests/${project.id}`),
        },
        idempotencyKey: `project-session-client-${booking.id}`,
      },
    }).catch(() => undefined);

    try {
      const { pushBookingToGoogle } = await import("@/lib/studioCalendar.server");
      await pushBookingToGoogle(project.artist_id, {
        id: booking.id,
        startsAt: slot.starts_at,
        durationMinutes: slot.duration_minutes,
        summary: `Tattoo session ${bookedCount + 1}/${project.session_count}`,
        description: `InkSimulator project ${project.id}`,
      });
    } catch {
      // A Google sync problem must never break the booking itself.
    }

    return {
      accepted: true,
      bookingId: booking.id,
      sessionNumber: bookedCount + 1,
      awaitingDeposit,
    };
  });

/**
 * The studio cancels a booked session from its calendar: the time opens up
 * again, the session is marked cancelled, the customer is notified and the
 * Google Calendar event is removed.
 */
export const cancelStudioSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slotId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: slot } = await supabaseAdmin
      .from("studio_slots")
      .select("id, studio_id, starts_at, status")
      .eq("id", data.slotId)
      .maybeSingle();
    if (!slot) throw new Error("Time not found.");
    const { data: allowed } = await context.supabase.rpc("is_studio_staff", {
      _studio: slot.studio_id,
      _user: context.userId,
    });
    if (!allowed) throw new Error("Only the studio can cancel a session.");

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, user_id, studio_name, artist_project_id, session_number")
      .eq("slot_id", slot.id)
      .neq("status", "cancelled")
      .maybeSingle();

    const { error: slotError } = await supabaseAdmin
      .from("studio_slots")
      .update({ status: "open", booked_by: null, booked_at: null, approved_at: null })
      .eq("id", slot.id);
    if (slotError) throw slotError;

    if (booking) {
      await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
      const starts = new Date(slot.starts_at);
      const when = starts.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      const { notifyUser } = await import("@/lib/notify.server");
      await notifyUser(booking.user_id, {
        kind: "change",
        title: "The studio cancelled your session",
        body: `${booking.studio_name} · ${when}. Pick a new time in the project.`,
        url: booking.artist_project_id ? `/requests/${booking.artist_project_id}` : "/bookings",
        inApp: { kind: "booking", actorId: context.userId },
        email: {
          template: "booking-status",
          templateData: {
            studioName: booking.studio_name,
            status: "cancelled",
            date: when,
            time: "",
            link: booking.artist_project_id
              ? publicSiteUrl(`/requests/${booking.artist_project_id}`)
              : publicSiteUrl("/bookings"),
          },
          idempotencyKey: `session-cancelled-${booking.id}`,
        },
      }).catch(() => undefined);

      try {
        const { removeBookingFromGoogle } = await import("@/lib/studioCalendar.server");
        await removeBookingFromGoogle(slot.studio_id, booking.id);
      } catch {
        // A Google sync problem must never block the cancellation.
      }
    }

    return { ok: true };
  });
