import { callAsAppUser, appUserReconnectRequired } from "@/integrations/lovable/appUserConnector";
import { decryptConnectionKey, encryptConnectionKey } from "@/lib/connectionKeyCrypto.server";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const CALENDAR_CONNECTOR_ID = "google_calendar";
export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar",
];

type Link = { connection_key_ciphertext: string; calendar_id: string };

export async function getStudioCalendarKey(studioId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("studio_calendar_links")
    .select("connection_key_ciphertext, calendar_id")
    .eq("studio_id", studioId)
    .maybeSingle();
  const link = data as Link | null;
  if (!link) return null;
  return { key: decryptConnectionKey(link.connection_key_ciphertext), calendarId: link.calendar_id };
}

export async function saveStudioCalendarKey(
  studioId: string,
  connectionAPIKey: string,
  accountEmail: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("studio_calendar_links").upsert(
    {
      studio_id: studioId,
      connector_id: CALENDAR_CONNECTOR_ID,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      account_email: accountEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "studio_id" },
  );
  if (error) throw error;
}

async function calendarFetch(key: string, path: string, init?: RequestInit) {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: CALENDAR_CONNECTOR_ID,
    path,
    init,
    requiredScopes: CALENDAR_SCOPES,
  });
  if (await appUserReconnectRequired(res)) {
    throw new Error("reconnect_required");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar request failed [${res.status}]: ${body}`);
  }
  return res;
}

/** Finds an existing InkSimulator-created event for one booking, if any. */
async function findEventId(key: string, calendarId: string, bookingId: string) {
  const res = await calendarFetch(
    key,
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?privateExtendedProperty=${encodeURIComponent(`inkvisionBookingId=${bookingId}`)}&showDeleted=false&maxResults=5`,
  );
  const payload = (await res.json()) as { items?: Array<{ id: string }> };
  return payload.items?.[0]?.id ?? null;
}

/**
 * Writes one confirmed session into the studio's Google Calendar. Re-running
 * it for the same booking updates the existing event instead of duplicating.
 */
export async function pushBookingToGoogle(
  studioId: string,
  event: { id: string; startsAt: string; durationMinutes: number; summary: string; description?: string },
) {
  const link = await getStudioCalendarKey(studioId);
  if (!link) return { pushed: false };
  const end = new Date(new Date(event.startsAt).getTime() + event.durationMinutes * 60000);
  const body = JSON.stringify({
    summary: event.summary,
    description: event.description ?? "Booked through InkSimulator",
    start: { dateTime: new Date(event.startsAt).toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: { private: { inkvisionBookingId: event.id } },
  });
  const existing = await findEventId(link.key, link.calendarId, event.id).catch(() => null);
  const base = `/calendar/v3/calendars/${encodeURIComponent(link.calendarId)}/events`;
  await calendarFetch(link.key, existing ? `${base}/${encodeURIComponent(existing)}` : base, {
    method: existing ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { pushed: true, updated: Boolean(existing) };
}

/** Removes the Google event for a cancelled booking. */
export async function removeBookingFromGoogle(studioId: string, bookingId: string) {
  const link = await getStudioCalendarKey(studioId);
  if (!link) return { removed: false };
  const existing = await findEventId(link.key, link.calendarId, bookingId).catch(() => null);
  if (!existing) return { removed: false };
  await calendarFetch(
    link.key,
    `/calendar/v3/calendars/${encodeURIComponent(link.calendarId)}/events/${encodeURIComponent(existing)}`,
    { method: "DELETE" },
  );
  return { removed: true };
}


/**
 * Reads busy events from the studio's Google Calendar and blocks the matching
 * InkSimulator times so the studio can never be double-booked.
 */
export async function syncGoogleBusy(studioId: string, days = 60) {
  const link = await getStudioCalendarKey(studioId);
  if (!link) return { blocked: 0, released: 0, linked: false };

  const timeMin = new Date();
  const timeMax = new Date(timeMin.getTime() + days * 86400000);
  const res = await calendarFetch(
    link.key,
    `/calendar/v3/calendars/${encodeURIComponent(link.calendarId)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin.toISOString())}&timeMax=${encodeURIComponent(timeMax.toISOString())}&maxResults=2500`,
  );
  const payload = (await res.json()) as {
    items?: Array<{
      id: string;
      status?: string;
      transparency?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      extendedProperties?: { private?: Record<string, string> };
    }>;
  };

  const busy = (payload.items ?? [])
    .filter((e) => e.status !== "cancelled" && e.transparency !== "transparent")
    .filter((e) => !e.extendedProperties?.private?.["inkvisionBookingId"])
    .map((e) => {
      const start = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00Z` : null);
      const end = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T23:59:59Z` : null);
      return start && end ? { start: new Date(start), end: new Date(end) } : null;
    })
    .filter((x): x is { start: Date; end: Date } => Boolean(x));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: slots } = await supabaseAdmin
    .from("studio_slots")
    .select("id, starts_at, duration_minutes, status, source")
    .eq("studio_id", studioId)
    .gte("starts_at", timeMin.toISOString())
    .lt("starts_at", timeMax.toISOString());

  const overlaps = (slotStart: Date, slotEnd: Date) =>
    busy.some((b) => slotStart < b.end && slotEnd > b.start);

  const toBlock: string[] = [];
  const toRelease: string[] = [];
  for (const slot of (slots ?? []) as Array<{
    id: string;
    starts_at: string;
    duration_minutes: number;
    status: string;
    source: string;
  }>) {
    const start = new Date(slot.starts_at);
    const end = new Date(start.getTime() + slot.duration_minutes * 60000);
    const clash = overlaps(start, end);
    if (clash && slot.status === "open") toBlock.push(slot.id);
    if (!clash && slot.status === "blocked" && slot.source === "google") toRelease.push(slot.id);
  }

  if (toBlock.length > 0) {
    await supabaseAdmin
      .from("studio_slots")
      .update({ status: "blocked", source: "google" })
      .in("id", toBlock);
  }
  if (toRelease.length > 0) {
    await supabaseAdmin
      .from("studio_slots")
      .update({ status: "open", source: "studio" })
      .in("id", toRelease);
  }

  await supabaseAdmin
    .from("studio_calendar_links")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("studio_id", studioId);

  return { blocked: toBlock.length, released: toRelease.length, linked: true };
}
