import { buildPushPayload } from "@block65/webcrypto-web-push";

export type NotifyKind = "confirmation" | "reminder" | "change" | "scan" | "message";

export interface NotifyOptions {
  kind: NotifyKind;
  title: string;
  body: string;
  url?: string;
  email?: {
    template: string;
    templateData?: Record<string, unknown>;
    idempotencyKey?: string;
  };
  /** Also drop a row in the in-app notification centre. */
  inApp?: {
    kind: "booking" | "message";
    actorId?: string | null;
    conversationId?: string | null;
  };
}

/**
 * Writes an in-app notification row (bell + /notifications). Always delivered,
 * independent of e-mail/push preferences, so nothing is silently lost.
 */
export async function notifyInApp(
  userId: string,
  opts: {
    kind: "booking" | "message";
    body: string;
    actorId?: string | null;
    conversationId?: string | null;
    link?: string | null;
  },
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      actor_id: opts.actorId ?? null,
      kind: opts.kind,
      conversation_id: opts.conversationId ?? null,
      body: opts.body.slice(0, 140),
      link: opts.link ?? null,
    });
    return true;
  } catch (err) {
    console.error("[notify] in-app insert failed", err);
    return false;
  }
}

interface Prefs {
  email_enabled: boolean;
  push_enabled: boolean;
  inapp_enabled: boolean;
  extra_emails: string[];
  on_confirmation: boolean;
  on_reminder: boolean;
  on_change: boolean;
  on_scan: boolean;
  on_message: boolean;
  reminder_hours: number;
  quiet_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  quiet_tz: string;
  quiet_scope: string;
}

const DEFAULT_PREFS: Prefs = {
  email_enabled: true,
  push_enabled: true,
  inapp_enabled: true,
  extra_emails: [],
  on_confirmation: true,
  on_reminder: true,
  on_change: true,
  on_scan: true,
  on_message: true,
  reminder_hours: 24,
  quiet_enabled: false,
  quiet_start: "22:00",
  quiet_end: "07:00",
  quiet_tz: "UTC",
  quiet_scope: "push",
};

export async function getPrefs(userId: string): Promise<Prefs> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_PREFS;
  return {
    email_enabled: data.email_enabled,
    push_enabled: data.push_enabled,
    inapp_enabled: data.inapp_enabled ?? true,
    extra_emails: (data.extra_emails ?? []) as string[],
    on_confirmation: data.on_confirmation,
    on_reminder: data.on_reminder,
    on_change: data.on_change,
    on_scan: data.on_scan ?? true,
    on_message: data.on_message ?? true,
    reminder_hours: data.reminder_hours,
    quiet_enabled: data.quiet_enabled ?? false,
    quiet_start: (data.quiet_start as string | null) ?? "22:00",
    quiet_end: (data.quiet_end as string | null) ?? "07:00",
    quiet_tz: data.quiet_tz ?? "UTC",
    quiet_scope: data.quiet_scope ?? "push",
  };
}

function wantsKind(prefs: Prefs, kind: NotifyKind) {
  if (kind === "confirmation") return prefs.on_confirmation;
  if (kind === "reminder") return prefs.on_reminder;
  if (kind === "scan") return prefs.on_scan;
  if (kind === "message") return prefs.on_message;
  return prefs.on_change;
}

/** Minutes since midnight in the user's own time zone. */
function localMinutes(tz: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    const [h, m] = parts.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  } catch {
    const now = new Date();
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True when "do not disturb" is active right now for the given channel. */
export function inQuietHours(prefs: Prefs, channel: "push" | "inapp") {
  if (!prefs.quiet_enabled) return false;
  if (prefs.quiet_scope !== "both" && prefs.quiet_scope !== channel) return false;
  const now = localMinutes(prefs.quiet_tz);
  const start = toMinutes(prefs.quiet_start);
  const end = toMinutes(prefs.quiet_end);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** Primary address: studio contact email when present, otherwise the auth email. */
export async function primaryEmail(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: artist } = await supabaseAdmin
    .from("artist_profiles")
    .select("contact_email, notify_email")
    .eq("user_id", userId)
    .maybeSingle();
  if (artist?.notify_email?.trim()) return artist.notify_email.trim();
  if (artist?.contact_email) return artist.contact_email;
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  return authUser?.user?.email ?? null;
}

async function sendPush(userId: string, opts: NotifyOptions) {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!publicKey || !privateKey) return 0;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return 0;

  let delivered = 0;
  for (const sub of subs) {
    try {
      const message = {
        data: JSON.stringify({
          title: opts.title,
          body: opts.body,
          url: opts.url ?? "/bookings",
          tag: opts.kind,
        }),
        options: { ttl: 60 * 60 * 12 },
      };
      const payload = await buildPushPayload(
        message,
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
          expirationTime: null,
        },
        { subject: "mailto:hello@inksimulator.com", publicKey, privateKey },
      );
      const res = await fetch(sub.endpoint, payload as unknown as RequestInit);
      if (res.status === 404 || res.status === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else if (res.ok) {
        delivered += 1;
      } else {
        console.error("[notify] push rejected", res.status, await res.text());
      }
    } catch (err) {
      console.error("[notify] push failed", err);
    }
  }
  return delivered;
}

/**
 * Fans one event out to every channel the user enabled: email (primary +
 * extra addresses) and web push. Silently skips channels that are off.
 */
export interface NotifyDetail {
  channel: "email" | "push";
  target: string;
  ok: boolean;
  reason?: string;
}

export async function notifyUser(userId: string, opts: NotifyOptions) {
  const prefs = await getPrefs(userId);
  const details: NotifyDetail[] = [];
  if (
    opts.inApp &&
    prefs.inapp_enabled &&
    wantsKind(prefs, opts.kind) &&
    !inQuietHours(prefs, "inapp")
  ) {
    await notifyInApp(userId, {
      kind: opts.inApp.kind,
      body: opts.body || opts.title,
      actorId: opts.inApp.actorId,
      conversationId: opts.inApp.conversationId,
      link: opts.url ?? null,
    });
  }
  if (!wantsKind(prefs, opts.kind))
    return { emails: 0, push: 0, skipped: true, details, reason: "muted_by_prefs" as const };

  let emails = 0;
  if (prefs.email_enabled && opts.email) {
    const primary = await primaryEmail(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: studio } = await supabaseAdmin.from("artist_profiles")
      .select("user_id").eq("user_id", userId).maybeSingle();
    // Studio mail goes only to that studio's chosen address (or account email
    // if none has been supplied), never to unrelated notification recipients.
    const recipients = Array.from(new Set([primary, ...(studio ? [] : prefs.extra_emails)]
      .filter((e): e is string => Boolean(e))
      .filter(e => e.trim().toLowerCase() !== "1891frs@gmail.com" || primary?.trim().toLowerCase() === "1891frs@gmail.com")));
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      for (const to of recipients) {
        const result = await sendTemplateEmail(opts.email.template, to, {
          templateData: opts.email.templateData as Record<string, any> | undefined,
          idempotencyKey: opts.email.idempotencyKey
            ? `${opts.email.idempotencyKey}-${to}`
            : undefined,
        });
        if (result.sent) emails += 1;
        details.push({
          channel: "email",
          target: to,
          ok: result.sent,
          reason: result.sent ? undefined : ((result as { reason?: string }).reason ?? "not_sent"),
        });
      }
    } catch (err) {
      console.error("[notify] email failed", err);
      details.push({
        channel: "email",
        target: "email",
        ok: false,
        reason: err instanceof Error ? err.message : "send_failed",
      });
    }
  } else if (opts.email) {
    details.push({ channel: "email", target: "email", ok: false, reason: "email_off" });
  }

  let push = 0;
  if (prefs.push_enabled && inQuietHours(prefs, "push")) {
    details.push({ channel: "push", target: "devices", ok: false, reason: "quiet_hours" });
  } else if (prefs.push_enabled) {
    push = await sendPush(userId, opts);
    details.push({
      channel: "push",
      target: "devices",
      ok: push > 0,
      reason: push > 0 ? undefined : "no_registered_device",
    });
  } else {
    details.push({ channel: "push", target: "devices", ok: false, reason: "push_off" });
  }
  return { emails, push, skipped: false, details };
}
