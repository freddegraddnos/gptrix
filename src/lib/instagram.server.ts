import { createHmac, timingSafeEqual } from "node:crypto";
import { decryptConnectionKey, encryptConnectionKey } from "@/lib/connectionKeyCrypto.server";

export const IG_SCOPES = "instagram_business_basic,instagram_business_manage_messages";
const GRAPH = "https://graph.instagram.com/v21.0";
const OAUTH_TOKEN_URL = "https://api.instagram.com/oauth/access_token";

export type InstagramConfig = { appId: string; appSecret: string; verifyToken: string };

/** Returns the Meta app credentials, or null while the app is not set up yet. */
export function instagramConfig(): InstagramConfig | null {
  const appId = process.env["INSTAGRAM_APP_ID"];
  const appSecret = process.env["INSTAGRAM_APP_SECRET"];
  const verifyToken = process.env["INSTAGRAM_WEBHOOK_VERIFY_TOKEN"];
  if (!appId || !appSecret || !verifyToken) return null;
  return { appId, appSecret, verifyToken };
}

export function redirectUri(origin: string) {
  return new URL("/api/public/instagram/callback", origin).toString();
}

/** Signs the studio id into the OAuth state so the callback knows who connected. */
export function signState(studioId: string, secret: string) {
  const issued = Date.now().toString(36);
  const payload = `${studioId}.${issued}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
  return `${payload}.${sig}`;
}

export function verifyState(state: string, secret: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [studioId, issued, sig] = parts;
  const expected = createHmac("sha256", secret)
    .update(`${studioId}.${issued}`)
    .digest("hex")
    .slice(0, 32);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Date.now() - parseInt(issued, 36) > 30 * 60 * 1000) return null;
  return studioId;
}

/** Meta signs every webhook body; reject anything we cannot verify. */
export function verifyWebhookSignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const provided = header.slice(7);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function authorizeUrl(config: InstagramConfig, origin: string, state: string) {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", IG_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Swaps the one-time code for a 60-day token and reads the account profile. */
export async function exchangeCode(config: InstagramConfig, code: string, origin: string) {
  const form = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(origin),
    code,
  });
  const shortRes = await fetch(OAUTH_TOKEN_URL, { method: "POST", body: form });
  const shortBody = await shortRes.text();
  if (!shortRes.ok)
    throw new Error(`Instagram token exchange failed [${shortRes.status}]: ${shortBody}`);
  const short = JSON.parse(shortBody) as { access_token: string; user_id?: number | string };

  const longUrl = new URL(`${GRAPH}/access_token`);
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", config.appSecret);
  longUrl.searchParams.set("access_token", short.access_token);
  const longRes = await fetch(longUrl);
  const longBody = await longRes.text();
  if (!longRes.ok)
    throw new Error(`Instagram long-lived token failed [${longRes.status}]: ${longBody}`);
  const long = JSON.parse(longBody) as { access_token: string; expires_in: number };

  const meRes = await fetch(
    `${GRAPH}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(long.access_token)}`,
  );
  const me = meRes.ok
    ? ((await meRes.json()) as { user_id?: string; username?: string; account_type?: string })
    : {};
  return {
    token: long.access_token,
    expiresAt: new Date(Date.now() + long.expires_in * 1000).toISOString(),
    igUserId: String(me.user_id ?? short.user_id ?? ""),
    username: me.username ?? null,
    accountType: me.account_type ?? null,
  };
}

export async function saveInstagramLink(
  studioId: string,
  link: {
    token: string;
    expiresAt: string;
    igUserId: string;
    username: string | null;
    accountType: string | null;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("studio_instagram_links").upsert(
    {
      studio_id: studioId,
      ig_user_id: link.igUserId,
      username: link.username,
      account_type: link.accountType,
      token_ciphertext: encryptConnectionKey(link.token),
      token_expires_at: link.expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "studio_id" },
  );
  if (error) throw error;
}

export async function getInstagramLink(studioId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("studio_instagram_links")
    .select("ig_user_id, username, account_type, token_ciphertext, token_expires_at")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!data) return null;
  return {
    igUserId: data.ig_user_id,
    username: data.username,
    accountType: data.account_type,
    token: decryptConnectionKey(data.token_ciphertext),
    expiresAt: data.token_expires_at,
  };
}

/** Returns the scopes currently granted for a studio's Instagram token. */
export async function checkInstagramPermissions(studioId: string) {
  const link = await getInstagramLink(studioId);
  if (!link) return null;
  const res = await fetch(`${GRAPH}/me/permissions?access_token=${encodeURIComponent(link.token)}`);
  if (!res.ok) return null;
  const body = (await res.json()) as {
    data?: { permission: string; status: string }[];
  };
  const granted = new Set(
    (body.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission),
  );
  return {
    instagram_business_basic: granted.has("instagram_business_basic"),
    instagram_business_manage_messages: granted.has("instagram_business_manage_messages"),
  };
}

/** Long-lived tokens last 60 days; refresh anything expiring within a week. */
export async function refreshInstagramTokens() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() + 7 * 86400_000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("studio_instagram_links")
    .select("studio_id, ig_user_id, username, account_type, token_ciphertext")
    .lt("token_expires_at", cutoff);
  let refreshed = 0;
  for (const row of rows ?? []) {
    try {
      const url = new URL(`${GRAPH}/refresh_access_token`);
      url.searchParams.set("grant_type", "ig_refresh_token");
      url.searchParams.set("access_token", decryptConnectionKey(row.token_ciphertext));
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = (await res.json()) as { access_token: string; expires_in: number };
      await saveInstagramLink(row.studio_id, {
        token: body.access_token,
        expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
        igUserId: row.ig_user_id,
        username: row.username,
        accountType: row.account_type,
      });
      refreshed += 1;
    } catch (cause) {
      console.error("[instagram] token refresh failed", cause);
    }
  }
  return refreshed;
}

/** Sends one DM as the studio's Instagram account. */
export async function sendInstagramDm(studioId: string, recipientId: string, text: string) {
  const link = await getInstagramLink(studioId);
  if (!link) throw new Error("Instagram is not connected for this studio.");
  const res = await fetch(`${GRAPH}/${encodeURIComponent(link.igUserId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${link.token}` },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Instagram send failed [${res.status}]: ${body}`);
  const parsed = JSON.parse(body) as { message_id?: string };
  return parsed.message_id ?? null;
}

/** Fetches the sender's public name so threads are not just numeric ids. */
export async function fetchParticipant(studioId: string, participantId: string) {
  const link = await getInstagramLink(studioId);
  if (!link) return null;
  const res = await fetch(
    `${GRAPH}/${encodeURIComponent(participantId)}?fields=name,username,profile_pic&access_token=${encodeURIComponent(link.token)}`,
  );
  if (!res.ok) return null;
  return (await res.json()) as { name?: string; username?: string; profile_pic?: string };
}

/** Creates the thread when it is new and stores one message on it. */
export async function recordInstagramMessage(input: {
  studioId: string;
  participantId: string;
  direction: "in" | "out";
  body: string | null;
  attachmentUrl?: string | null;
  igMessageId?: string | null;
  participant?: { name?: string | null; username?: string | null; avatar?: string | null };
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from("instagram_threads")
    .select("id, unread_count")
    .eq("studio_id", input.studioId)
    .eq("ig_thread_id", input.participantId)
    .maybeSingle();

  let threadId = existing?.id ?? null;
  if (!threadId) {
    const profile =
      input.participant ?? (await fetchParticipant(input.studioId, input.participantId)) ?? {};
    const { data: created, error } = await supabaseAdmin
      .from("instagram_threads")
      .insert({
        studio_id: input.studioId,
        ig_thread_id: input.participantId,
        participant_id: input.participantId,
        participant_name: profile.name ?? null,
        participant_username: profile.username ?? null,
        participant_avatar: (profile as { profile_pic?: string }).profile_pic ?? null,
        last_message_at: nowIso,
        last_inbound_at: input.direction === "in" ? nowIso : null,
        unread_count: input.direction === "in" ? 1 : 0,
      })
      .select("id")
      .single();
    if (error || !created) throw error ?? new Error("Could not create Instagram thread.");
    threadId = created.id;
  } else {
    await supabaseAdmin
      .from("instagram_threads")
      .update({
        last_message_at: nowIso,
        ...(input.direction === "in"
          ? { last_inbound_at: nowIso, unread_count: (existing?.unread_count ?? 0) + 1 }
          : { unread_count: 0 }),
      })
      .eq("id", threadId);
  }

  const { data: message } = await supabaseAdmin
    .from("instagram_messages")
    .upsert(
      {
        thread_id: threadId,
        direction: input.direction,
        body: input.body,
        attachment_url: input.attachmentUrl ?? null,
        ig_message_id: input.igMessageId ?? null,
      },
      { onConflict: "ig_message_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  return { threadId, messageId: message?.id ?? null };
}
