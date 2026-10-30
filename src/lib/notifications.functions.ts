import { publicSiteUrl } from "@/lib/publicOrigin";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public VAPID key needed by the browser to subscribe to push. */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env["VAPID_PUBLIC_KEY"] ?? null };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        endpoint: z.string().url(),
        p256dh: z.string().min(10),
        auth: z.string().min(4),
        userAgent: z.string().max(300).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("[notifications] save subscription failed", error.message);
      return { ok: false };
    }
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ endpoint: z.string().url() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** Sends a test notification to the caller's own devices/emails. */
export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { notifyUser } = await import("@/lib/notify.server");
    return await notifyUser(context.userId, {
      kind: "change",
      title: "Notifications are on",
      body: "This is how your booking updates will look.",
      url: "/bookings",
      email: {
        template: "booking-status",
        templateData: {
          studioName: "InkSimulator",
          status: "confirmed",
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toISOString().slice(11, 16),
          link: publicSiteUrl("/bookings"),
        },
        idempotencyKey: `test-${context.userId}-${Date.now()}`,
      },
    });
  });

const KINDS = ["confirmation", "reminder", "change"] as const;

/**
 * "Test notifications" workflow: sends one sample of each selected event type
 * through the recipient's own channel preferences, optionally including the
 * counterpart (client <-> studio) from the most recent shared booking.
 * Reports a per-recipient, per-channel status so nothing fails silently.
 */
export const runNotificationTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        kinds: z.array(z.enum(KINDS)).min(1),
        includePartner: z.boolean().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyUser, primaryEmail } = await import("@/lib/notify.server");

    const me = context.userId;
    const recipients: { userId: string; role: string }[] = [{ userId: me, role: "You" }];

    if (data.includePartner) {
      const { data: asClient } = await supabaseAdmin
        .from("bookings")
        .select("artist_id, studio_name")
        .eq("user_id", me)
        .not("artist_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: asStudio } = await supabaseAdmin
        .from("bookings")
        .select("user_id")
        .eq("artist_id", me)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const partnerId = asClient?.artist_id ?? asStudio?.user_id ?? null;
      if (partnerId && partnerId !== me) {
        recipients.push({
          userId: partnerId,
          role: asClient?.artist_id ? (asClient.studio_name ?? "Studio") : "Client",
        });
      }
    }

    const sample = {
      studioName: "InkSimulator test studio",
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      time: "14:00",
      address: "Test address 1",
      status: "confirmed",
      link: publicSiteUrl("/bookings"),
    };

    const results: {
      role: string;
      email: string | null;
      kind: string;
      delivered: boolean;
      channels: { channel: string; target: string; ok: boolean; reason?: string }[];
      reason?: string;
    }[] = [];

    for (const recipient of recipients) {
      const address = await primaryEmail(recipient.userId);
      for (const kind of data.kinds) {
        const template =
          kind === "reminder"
            ? "booking-reminder"
            : kind === "confirmation"
              ? "booking-received"
              : "booking-status";
        const res = await notifyUser(recipient.userId, {
          kind,
          title:
            kind === "reminder"
              ? "Test: appointment coming up"
              : kind === "confirmation"
                ? "Test: booking confirmation"
                : "Test: booking change",
          body: "This is a test notification from InkSimulator.",
          url: "/bookings",
          email: {
            template,
            templateData: sample,
            idempotencyKey: `notif-test-${recipient.userId}-${kind}-${Date.now()}`,
          },
        });
        results.push({
          role: recipient.role,
          email: address,
          kind,
          delivered: res.emails > 0 || res.push > 0,
          channels: res.details ?? [],
          reason: res.skipped ? "Turned off in preferences" : undefined,
        });
      }
    }

    return { ok: true, results };
  });
