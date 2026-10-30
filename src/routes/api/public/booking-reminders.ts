import { publicSiteUrl } from "@/lib/publicOrigin";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: sends "your appointment is coming up" reminders for calendar
 * slots and studio bookings that fall inside each user's reminder window.
 * Protected by a shared secret — call it every 15-60 minutes.
 */
export const Route = createFileRoute("/api/public/booking-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["BOOKING_REMINDER_SECRET"];
        const provided = request.headers.get("x-reminder-secret");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { notifyUser, getPrefs } = await import("@/lib/notify.server");

        const { zonedDateTime, formatInZone } = await import("@/lib/ics");
        const now = Date.now();
        const horizon = new Date(now + 48 * 3600 * 1000).toISOString();
        let sent = 0;

        // 1. Booked calendar slots.
        const { data: slots } = await supabaseAdmin
          .from("studio_slots")
          .select("id, studio_id, booked_by, starts_at, duration_minutes")
          .eq("status", "booked")
          .is("reminder_sent_at", null)
          .gt("starts_at", new Date(now).toISOString())
          .lt("starts_at", horizon);

        for (const slot of slots ?? []) {
          if (!slot.booked_by) continue;
          const prefs = await getPrefs(slot.booked_by);
          const hoursAway = (new Date(slot.starts_at).getTime() - now) / 3600000;
          if (hoursAway > prefs.reminder_hours) continue;

          const { data: studio } = await supabaseAdmin
            .from("artist_profiles")
            .select("studio_name, address")
            .eq("user_id", slot.studio_id)
            .maybeSingle();
          const when = new Date(slot.starts_at);

          await notifyUser(slot.booked_by, {
            kind: "reminder",
            title: "Appointment coming up",
            body: `${studio?.studio_name ?? "Your studio"} · ${formatInZone(when)}`,
            url: "/bookings",
            email: {
              template: "booking-reminder",
              templateData: {
                studioName: studio?.studio_name ?? "Your studio",
                date: slot.starts_at.slice(0, 10),
                time: slot.starts_at.slice(11, 16),
                address: studio?.address ?? "",
                link: publicSiteUrl("/bookings"),
              },
              idempotencyKey: `slot-reminder-${slot.id}`,
            },
          });
          await supabaseAdmin
            .from("studio_slots")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", slot.id);
          sent += 1;
        }

        // 2. Confirmed studio bookings.
        const { data: bookings } = await supabaseAdmin
          .from("bookings")
          .select(
            "id, user_id, artist_id, studio_name, studio_address, preferred_date, preferred_time",
          )
          .eq("status", "confirmed")
          .is("reminder_sent_at", null)
          .gte("preferred_date", new Date(now).toISOString().slice(0, 10))
          .lte("preferred_date", horizon.slice(0, 10));

        for (const booking of bookings ?? []) {
          const startsAt = zonedDateTime(
            booking.preferred_date,
            booking.preferred_time,
          ).getTime();
          const hoursAway = (startsAt - now) / 3600000;
          if (hoursAway < 0) continue;
          const targets = [booking.user_id, booking.artist_id].filter(
            (id): id is string => Boolean(id),
          );
          let any = false;
          for (const target of targets) {
            const prefs = await getPrefs(target);
            if (hoursAway > prefs.reminder_hours) continue;
            await notifyUser(target, {
              kind: "reminder",
              title: "Appointment coming up",
              body: `${booking.studio_name} · ${booking.preferred_date} ${booking.preferred_time ?? ""}`,
              url: "/bookings",
              email: {
                template: "booking-reminder",
                templateData: {
                  studioName: booking.studio_name,
                  date: booking.preferred_date,
                  time: booking.preferred_time ?? "",
                  address: booking.studio_address ?? "",
                  link: publicSiteUrl("/bookings"),
                },
                idempotencyKey: `booking-reminder-${booking.id}-${target}`,
              },
            });
            any = true;
          }
          if (any) {
            await supabaseAdmin
              .from("bookings")
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq("id", booking.id);
            sent += 1;
          }
        }

        // 3. Project bookings within 48 h: unpaid deposit + unapproved sketch.
        const { data: projectBookings } = await supabaseAdmin
          .from("bookings")
          .select("id, artist_project_id, user_id, artist_id, studio_name, preferred_date, preferred_time, status")
          .not("artist_project_id", "is", null)
          .in("status", ["confirmed", "awaiting_deposit"])
          .gte("preferred_date", new Date(now).toISOString().slice(0, 10))
          .lte("preferred_date", horizon.slice(0, 10));

        const dayMs = 24 * 3600 * 1000;
        for (const booking of projectBookings ?? []) {
          const projectId = booking.artist_project_id as string;
          const startsAt = zonedDateTime(
            booking.preferred_date,
            booking.preferred_time,
          ).getTime();
          const hoursAway = (startsAt - now) / 3600000;
          if (hoursAway < 0) continue;
          const parties = [booking.user_id, booking.artist_id].filter(
            (id): id is string => Boolean(id),
          );
          const when = `${booking.preferred_date}${booking.preferred_time ? ` ${booking.preferred_time}` : ""}`;

          // Unpaid deposit — at most once a day.
          const { data: deposit } = await supabaseAdmin
            .from("project_deposits")
            .select("id, amount_ore, status, reminder_sent_at")
            .eq("project_id", projectId)
            .eq("status", "unpaid")
            .maybeSingle();
          if (
            deposit &&
            (!deposit.reminder_sent_at ||
              now - new Date(deposit.reminder_sent_at).getTime() > dayMs)
          ) {
            for (const target of parties) {
              const isStudio = target === booking.artist_id;
              const url = isStudio ? `/artists/requests/${projectId}` : `/requests/${projectId}`;
              await notifyUser(target, {
                kind: "reminder",
                title: "Deposit still unpaid",
                body: `${booking.studio_name} · ${when} · ${Math.round(deposit.amount_ore / 100)} kr`,
                url,
                inApp: { kind: "booking" },
                email: {
                  template: "new-message",
                  templateData: {
                    senderName: "InkSimulator",
                    preview: `The deposit of ${Math.round(deposit.amount_ore / 100)} kr for ${when} is still unpaid.`,
                    link: publicSiteUrl(`${url}`),
                  },
                  idempotencyKey: `deposit-reminder-${deposit.id}-${Math.floor(now / dayMs)}-${target}`,
                },
              }).catch(() => undefined);
            }
            await supabaseAdmin
              .from("project_deposits")
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq("id", deposit.id);
            sent += 1;
          }

          // Sketch not approved 48 h before the booked time.
          if (hoursAway <= 48) {
            const { data: project } = await supabaseAdmin
              .from("artist_client_projects")
              .select("id, final_sketch_version_id, sketch_reminder_sent_at")
              .eq("id", projectId)
              .maybeSingle();
            if (project && !project.final_sketch_version_id && !project.sketch_reminder_sent_at) {
              for (const target of parties) {
                const isStudio = target === booking.artist_id;
                const url = isStudio ? `/artists/requests/${projectId}` : `/requests/${projectId}`;
                await notifyUser(target, {
                  kind: "reminder",
                  title: "Sketch not approved yet",
                  body: `${booking.studio_name} · ${when} · approve the final sketch`,
                  url,
                  inApp: { kind: "booking" },
                  email: {
                    template: "new-message",
                    templateData: {
                      senderName: "InkSimulator",
                      preview: `The sketch for ${when} has not been approved yet.`,
                      link: publicSiteUrl(`${url}`),
                    },
                    idempotencyKey: `sketch-reminder-${projectId}-${target}`,
                  },
                }).catch(() => undefined);
              }
              await supabaseAdmin
                .from("artist_client_projects")
                .update({ sketch_reminder_sent_at: new Date().toISOString() })
                .eq("id", projectId);
              sent += 1;
            }
          }
        }

        // 4. Unpaid deposits with no upcoming session yet — one nudge a day.
        const { data: openDeposits } = await supabaseAdmin
          .from("project_deposits")
          .select("id, project_id, studio_id, amount_ore, reminder_sent_at")
          .eq("status", "unpaid");

        for (const deposit of openDeposits ?? []) {
          if (
            deposit.reminder_sent_at &&
            now - new Date(deposit.reminder_sent_at).getTime() <= dayMs
          )
            continue;
          const { data: project } = await supabaseAdmin
            .from("artist_client_projects")
            .select("id, title, client_user_id, artist_id")
            .eq("id", deposit.project_id)
            .maybeSingle();
          if (!project?.client_user_id) continue;
          const amount = Math.round(deposit.amount_ore / 100);
          const url = `/requests/${project.id}`;
          await notifyUser(project.client_user_id, {
            kind: "reminder",
            title: "Deposit still unpaid",
            body: `${project.title} · ${amount} kr`,
            url,
            inApp: { kind: "booking" },
            email: {
              template: "new-message",
              templateData: {
                senderName: "InkSimulator",
                preview: `The deposit of ${amount} kr for ${project.title} is still unpaid.`,
                link: publicSiteUrl(`${url}`),
              },
              idempotencyKey: `deposit-open-${deposit.id}-${Math.floor(now / dayMs)}`,
            },
          }).catch(() => undefined);
          await supabaseAdmin
            .from("project_deposits")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", deposit.id);
          sent += 1;
        }

        // 5. Studio messages the customer has not answered after 24 h.
        const { data: staleMessages } = await supabaseAdmin
          .from("artist_project_messages")
          .select("id, project_id, sender_id, body, created_at")
          .is("reminder_sent_at", null)
          .lt("created_at", new Date(now - dayMs).toISOString())
          .gt("created_at", new Date(now - 7 * dayMs).toISOString())
          .order("created_at", { ascending: false })
          .limit(200);

        const remindedProjects = new Set<string>();
        for (const message of staleMessages ?? []) {
          const { data: project } = await supabaseAdmin
            .from("artist_client_projects")
            .select("id, title, client_user_id, artist_id")
            .eq("id", message.project_id)
            .maybeSingle();
          const stamp = new Date().toISOString();
          const markDone = () =>
            supabaseAdmin
              .from("artist_project_messages")
              .update({ reminder_sent_at: stamp })
              .eq("id", message.id);
          // Only unanswered messages from the studio side matter here.
          if (
            !project?.client_user_id ||
            message.sender_id === project.client_user_id ||
            remindedProjects.has(project.id)
          ) {
            await markDone();
            continue;
          }
          const { data: newer } = await supabaseAdmin
            .from("artist_project_messages")
            .select("id")
            .eq("project_id", project.id)
            .eq("sender_id", project.client_user_id)
            .gt("created_at", message.created_at)
            .limit(1);
          if (newer && newer.length > 0) {
            await markDone();
            continue;
          }
          const url = `/requests/${project.id}`;
          await notifyUser(project.client_user_id, {
            kind: "reminder",
            title: "Unread message from your studio",
            body: message.body.slice(0, 140) || "Sent an attachment",
            url,
            inApp: { kind: "message" },
            email: {
              template: "new-message",
              templateData: {
                senderName: "InkSimulator",
                preview: `Your studio is waiting for an answer about ${project.title}.`,
                link: publicSiteUrl(`${url}`),
              },
              idempotencyKey: `project-message-reminder-${message.id}`,
            },
          }).catch(() => undefined);
          await markDone();
          remindedProjects.add(project.id);
          sent += 1;
        }

        // 6. Agent bookings: studio's own reminder text, ~24 h before (SMS + email).
        const { data: agentRows } = await supabaseAdmin
          .from("agent_bookings")
          .select("id, customer_phone")
          .eq("status", "confirmed")
          .is("reminder_sent_at", null)
          .gt("starts_at", new Date(now).toISOString())
          .lt("starts_at", new Date(now + 24 * 3600 * 1000).toISOString());
        if (agentRows?.length) {
          const { sendAgentCustomerMessage } = await import("@/lib/agent.server");
          const { sendSms } = await import("@/lib/sms.server");
          for (const row of agentRows) {
            const m = await sendAgentCustomerMessage(row.id, "reminder").catch(() => null);
            if (m && row.customer_phone) await sendSms(row.customer_phone, m.text).catch(() => undefined);
            await supabaseAdmin.from("agent_bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", row.id);
            sent += 1;
          }
        }

        // 7. Keep Instagram tokens alive (they expire after 60 days).
        let instagramRefreshed = 0;
        try {
          const { refreshInstagramTokens } = await import("@/lib/instagram.server");
          instagramRefreshed = await refreshInstagramTokens();
        } catch (cause) {
          console.error("[reminders] instagram refresh failed", cause);
        }

        return Response.json({ ok: true, sent, instagramRefreshed });

      },
    },
  },
});
