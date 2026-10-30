import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

/** Starts Google consent for the signed-in studio account. */
export const startStudioCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientKey = process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientKey) throw new Error("Google Calendar is not set up for this app yet.");

    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/google-calendar/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const { getStudioCalendarKey, CALENDAR_SCOPES } = await import("@/lib/studioCalendar.server");
    const existing = await getStudioCalendarKey(context.userId).catch(() => null);
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existing?.key,
      credentialsConfiguration: { scopes: CALENDAR_SCOPES },
    });
    return { authorizationUrl };
  });

/** Exchanges the one-time code and stores the studio's connection encrypted. */
export const completeStudioCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CONNECTOR_ID) throw new Error("OAuth completion returned the wrong service.");
    const { saveStudioCalendarKey, syncGoogleBusy } = await import("@/lib/studioCalendar.server");
    await saveStudioCalendarKey(context.userId, connectionAPIKey, null);
    await syncGoogleBusy(context.userId).catch(() => undefined);
    return { ok: true };
  });

/** Reads Google busy times and blocks the matching InkSimulator times. */
export const syncStudioCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncGoogleBusy } = await import("@/lib/studioCalendar.server");
    try {
      return await syncGoogleBusy(context.userId);
    } catch (cause) {
      if (cause instanceof Error && cause.message === "reconnect_required") {
        return { blocked: 0, released: 0, linked: true, reconnectRequired: true };
      }
      throw cause;
    }
  });

/**
 * Calls Google once and reports exactly what came back, so the studio sees the
 * real reason instead of a generic "could not connect" message.
 */
export const testStudioCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStudioCalendarKey, GATEWAY_BASE_URL: base, CALENDAR_CONNECTOR_ID, CALENDAR_SCOPES } =
      await import("@/lib/studioCalendar.server");
    const link = await getStudioCalendarKey(context.userId);
    if (!link) return { ok: false, status: 0, detail: "No Google Calendar is connected yet." };
    const { callAsAppUser, appUserReconnectRequired } = await import(
      "@/integrations/lovable/appUserConnector"
    );
    const res = await callAsAppUser({
      gatewayBaseUrl: base,
      connectionAPIKey: link.key,
      connectorId: CALENDAR_CONNECTOR_ID,
      path: "/calendar/v3/users/me/calendarList?maxResults=1",
      requiredScopes: CALENDAR_SCOPES,
    });
    if (await appUserReconnectRequired(res)) {
      return {
        ok: false,
        status: res.status,
        detail: "Google access needs to be renewed — connect Google Calendar again.",
      };
    }
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, status: res.status, detail: body.slice(0, 500) };
    }
    const payload = (await res.json()) as { items?: Array<{ summary?: string }> };
    return {
      ok: true,
      status: res.status,
      detail: payload.items?.[0]?.summary
        ? `Google answered OK — calendar "${payload.items[0].summary}" is reachable.`
        : "Google answered OK.",
    };
  });

export const disconnectStudioCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStudioCalendarKey } = await import("@/lib/studioCalendar.server");
    const link = await getStudioCalendarKey(context.userId);
    if (link) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: link.key,
        connectorId: CONNECTOR_ID,
      }).catch(() => undefined);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("studio_calendar_links").delete().eq("studio_id", context.userId);
    await supabaseAdmin
      .from("studio_slots")
      .update({ status: "open", source: "studio" })
      .eq("studio_id", context.userId)
      .eq("source", "google")
      .eq("status", "blocked");
    return { ok: true };
  });
