import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VoteSessionType = "yes_no" | "a_b";
export type VoteChoice = "yes" | "no" | "a" | "b";

export type VoterEntry = {
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  /** Only set when the vote has an open profile. */
  choice: VoteChoice | null;
  createdAt: string;
};

export type VoteMediaType = "image" | "video";

export type PublicVoteSession = {
  ok: true;
  id: string;
  slug: string;
  type: VoteSessionType;
  imageUrlA: string;
  imageUrlB: string | null;
  mediaTypeA: VoteMediaType;
  mediaTypeB: VoteMediaType | null;
  caption: string | null;
  isProfileOpen: boolean;
  reactionEnabled: boolean;
  /** False for reaction-only links (no yes/no buttons). */
  voteEnabled: boolean;
  expiresAt: string;
  tally: Record<VoteChoice, number>;
  total: number;
  voters: VoterEntry[];
};

export type PublicVoteError = { ok: false; reason: "not_found" | "expired" };

const SIGNED_TTL = 60 * 60 * 6;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function makeSlug(len = 7): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

const mediaSchema = z.object({
  /** base64 data-URL eller redan uppladdad storage-path i bucketen "votes". */
  dataUrl: z.string().max(40_000_000).optional(),
  path: z.string().max(400).optional(),
  /** Only needed when a storage path is supplied directly. */
  mediaType: z.enum(["image", "video"]).optional(),
});

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Laddar upp en base64-bild eller -video till votes-bucketen. */
async function storeMedia(
  supabase: {
    storage: {
      from: (b: string) => {
        upload: (p: string, f: Blob, o?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
  userId: string,
  input: { dataUrl?: string; path?: string; mediaType?: "image" | "video" },
): Promise<{ path: string; mediaType: "image" | "video" }> {
  if (input.path) return { path: input.path, mediaType: input.mediaType ?? "image" };
  const dataUrl = input.dataUrl ?? "";
  const match =
    /^data:((?:image\/(?:png|jpeg|jpg|webp))|(?:video\/(?:mp4|webm|quicktime)));base64,(.+)$/i.exec(
      dataUrl,
    );
  if (!match)
    throw new Error("Unsupported file. Use PNG, JPEG, WebP, MP4 or WebM.");
  const mime = match[1]!.toLowerCase();
  const mediaType: "image" | "video" = mime.startsWith("video/") ? "video" : "image";
  const ext = EXT_BY_MIME[mime] ?? (mediaType === "video" ? "mp4" : "jpg");
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const maxBytes = mediaType === "video" ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
  if (bytes.length > maxBytes)
    throw new Error(
      mediaType === "video"
        ? "The video is too large (max 25 MB)."
        : "The image is too large (max 8 MB).",
    );

  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("votes")
    .upload(path, new Blob([bytes], { type: mime }), { contentType: mime, upsert: false });
  if (error) {
    console.error("vote media upload failed", error);
    throw new Error("Could not upload the file.");
  }
  return { path, mediaType };
}

/** Anonymized marker for the visitor's network address (never stored in plain text). */
async function ipHash(sessionId: string): Promise<string | null> {
  try {
    const req = getRequest();
    const raw =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    if (!raw) return null;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sessionId}:${raw}`));
    return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

type VoteRow = {
  choice: VoteChoice;
  voter_user_id: string | null;
  voter_display_name: string | null;
  created_at: string;
};

function emptyTally(): Record<VoteChoice, number> {
  return { yes: 0, no: 0, a: 0, b: 0 };
}

async function summarize(
  admin: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => Promise<{ data: VoteRow[] | null }>;
        in: (col: string, vals: string[]) => Promise<{ data: { id: string; display_name: string | null; avatar_url: string | null }[] | null }>;
      };
    };
  },
  sessionId: string,
  openProfile: boolean,
): Promise<{ tally: Record<VoteChoice, number>; total: number; voters: VoterEntry[] }> {
  const { data: rows } = await admin
    .from("votes")
    .select("choice, voter_user_id, voter_display_name, created_at")
    .eq("vote_session_id", sessionId);

  const votes = (rows ?? []) as VoteRow[];
  const tally = emptyTally();
  for (const v of votes) tally[v.choice] += 1;

  const userIds = Array.from(new Set(votes.map((v) => v.voter_user_id).filter((x): x is string => !!x)));
  const profiles = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id, display_name, avatar_url").in("id", userIds);
    for (const p of profs ?? []) profiles.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
  }

  const voters: VoterEntry[] = votes
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((v) => {
      const prof = v.voter_user_id ? profiles.get(v.voter_user_id) : undefined;
      return {
        displayName: prof?.display_name || v.voter_display_name || "Anonymous",
        avatarUrl: prof?.avatar_url ?? null,
        isGuest: !v.voter_user_id,
        choice: openProfile ? v.choice : null,
        createdAt: v.created_at,
      };
    });

  return { tally, total: votes.length, voters };
}

/**
 * Creates a vote (yes/no or A/B) and returns a short, public share link,
 * e.g. https://www.inksimulator.com/v/xyz123.
 */
export const createVoteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        type: z.enum(["yes_no", "a_b"]),
        caption: z.string().max(280).nullable().optional(),
        isProfileOpen: z.boolean().optional(),
        reactionEnabled: z.boolean().optional(),
        voteEnabled: z.boolean().optional(),
        expiresInDays: z.number().int().min(1).max(90).optional(),
        imageA: mediaSchema,
        imageB: mediaSchema.nullable().optional(),
        origin: z.string().url().max(200).optional(),
      })
      .refine((v) => v.type !== "a_b" || !!v.imageB, { message: "A/B voting requires two options." })
      .parse(raw),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ id: string; slug: string; url: string; expiresAt: string }> => {
      const { supabase, userId } = context;

      const mediaA = await storeMedia(supabase as never, userId, data.imageA);
      const mediaB =
        data.type === "a_b" && data.imageB
          ? await storeMedia(supabase as never, userId, data.imageB)
          : null;

      const expiresAt = new Date(
        Date.now() + (data.expiresInDays ?? 30) * 24 * 60 * 60 * 1000,
      ).toISOString();

      let lastError: unknown = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const slug = makeSlug();
        const { data: row, error } = await supabase
          .from("vote_sessions")
          .insert({
            slug,
            creator_user_id: userId,
            type: data.type,
            image_url_a: mediaA.path,
            image_url_b: mediaB?.path ?? null,
            media_type_a: mediaA.mediaType,
            media_type_b: mediaB?.mediaType ?? null,
            caption: data.caption ?? null,
            is_profile_open: data.isProfileOpen ?? false,
            reaction_enabled: data.reactionEnabled ?? false,
            vote_enabled: data.voteEnabled ?? true,
            expires_at: expiresAt,
          } as never)
          .select("id, slug, expires_at")
          .single();
        if (!error && row) {
          const origin = data.origin?.replace(/\/$/, "") ?? "https://www.inksimulator.com";
          return { id: row.id, slug: row.slug, url: `${origin}/v/${row.slug}`, expiresAt: row.expires_at };
        }
        lastError = error;
        if (error && error.code !== "23505") break;
      }
      console.error("createVoteSession failed", lastError);
      throw new Error("Could not create the vote.");
    },
  );

/** Public lookup of a vote via a short link code, including results. */
export const getVoteSession = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ slug: z.string().min(4).max(40) }).parse(raw))
  .handler(async ({ data }): Promise<PublicVoteSession | PublicVoteError> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("vote_sessions")
      .select(
        "id, slug, type, image_url_a, image_url_b, media_type_a, media_type_b, caption, is_profile_open, reaction_enabled, vote_enabled, expires_at",
      )
      .eq("slug", data.slug)
      .maybeSingle<{
        id: string;
        slug: string;
        type: string;
        image_url_a: string;
        image_url_b: string | null;
        media_type_a: string | null;
        media_type_b: string | null;
        caption: string | null;
        is_profile_open: boolean;
        reaction_enabled: boolean;
        vote_enabled: boolean | null;
        expires_at: string;
      }>();
    if (!session) return { ok: false, reason: "not_found" };
    if (new Date(session.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

    const sign = async (path: string | null): Promise<string | null> => {
      if (!path) return null;
      if (/^https?:\/\//i.test(path)) return path;
      const res = await supabaseAdmin.storage.from("votes").createSignedUrl(path, SIGNED_TTL);
      return res.data?.signedUrl ?? null;
    };

    const [urlA, urlB] = await Promise.all([sign(session.image_url_a), sign(session.image_url_b)]);
    if (!urlA) return { ok: false, reason: "not_found" };

    const summary = await summarize(supabaseAdmin as never, session.id, session.is_profile_open);

    return {
      ok: true,
      id: session.id,
      slug: session.slug,
      type: session.type as VoteSessionType,
      imageUrlA: urlA,
      imageUrlB: urlB,
      mediaTypeA: session.media_type_a === "video" ? "video" : "image",
      mediaTypeB: urlB
        ? session.media_type_b === "video"
          ? "video"
          : "image"
        : null,
      caption: session.caption,
      isProfileOpen: session.is_profile_open,
      reactionEnabled: session.reaction_enabled,
      voteEnabled: session.vote_enabled !== false,
      expiresAt: session.expires_at,
      ...summary,
    };
  });

export type CastVoteResult = {
  ok: boolean;
  alreadyVoted: boolean;
  yourChoice: VoteChoice | null;
  tally: Record<VoteChoice, number>;
  total: number;
  voters: VoterEntry[];
  isProfileOpen: boolean;
};

/** Registers a vote – works for both guests and logged-in users, one vote per device. */
export const castVote = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        slug: z.string().min(4).max(40),
        choice: z.enum(["yes", "no", "a", "b"]),
        displayName: z.string().max(60).nullable().optional(),
        userId: z.string().uuid().nullable().optional(),
        deviceId: z.string().min(6).max(80).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<CastVoteResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("vote_sessions")
      .select("id, type, is_profile_open, expires_at")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!session) throw new Error("Vote not found.");
    if (new Date(session.expires_at).getTime() < Date.now()) throw new Error("The vote has expired.");

    const allowed = session.type === "yes_no" ? ["yes", "no"] : ["a", "b"];
    if (!allowed.includes(data.choice)) throw new Error("Invalid choice for this vote.");

    const hash = await ipHash(session.id);

    // Simple duplicate guard: device, account, or network marker.
    let existing: VoteChoice | null = null;
    const dupChecks: { column: string; value: string }[] = [];
    if (data.deviceId) dupChecks.push({ column: "device_id", value: data.deviceId });
    if (data.userId) dupChecks.push({ column: "voter_user_id", value: data.userId });
    if (hash) dupChecks.push({ column: "voter_ip_hash", value: hash });
    for (const check of dupChecks) {
      const { data: prev } = await supabaseAdmin
        .from("votes")
        .select("choice")
        .eq("vote_session_id", session.id)
        .eq(check.column, check.value)
        .maybeSingle();
      if (prev) {
        existing = prev.choice as VoteChoice;
        break;
      }
    }

    if (!existing) {
      const { error } = await supabaseAdmin.from("votes").insert({
        vote_session_id: session.id,
        choice: data.choice,
        voter_type: data.userId ? "user" : "guest",
        voter_user_id: data.userId ?? null,
        voter_display_name: data.displayName?.trim() || null,
        device_id: data.deviceId ?? null,
        voter_ip_hash: hash,
      });
      if (error && error.code !== "23505") {
        console.error("castVote failed", error);
        throw new Error("Could not save the vote.");
      }
      if (error) existing = data.choice;
    }

    const summary = await summarize(supabaseAdmin as never, session.id, session.is_profile_open);
    return {
      ok: true,
      alreadyVoted: existing !== null,
      yourChoice: existing ?? data.choice,
      isProfileOpen: session.is_profile_open,
      ...summary,
    };
  });

/** Creator's full results view – always shows who voted what. */
export const getVoteResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ slug: z.string().min(4).max(40) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("vote_sessions")
      .select("id, slug, type, caption, is_profile_open, expires_at, creator_user_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!session || session.creator_user_id !== userId) throw new Error("Vote not found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const summary = await summarize(supabaseAdmin as never, session.id, true);
    return {
      slug: session.slug,
      type: session.type as VoteSessionType,
      caption: session.caption,
      isProfileOpen: session.is_profile_open,
      expiresAt: session.expires_at,
      ...summary,
    };
  });

/** Creator toggles between "Open profile" and "Private". */
export const setVoteProfileOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ slug: z.string().min(4).max(40), isProfileOpen: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ isProfileOpen: boolean }> => {
    const { error } = await context.supabase
      .from("vote_sessions")
      .update({ is_profile_open: data.isProfileOpen })
      .eq("slug", data.slug)
      .eq("creator_user_id", context.userId);
    if (error) {
      console.error("setVoteProfileOpen failed", error);
      throw new Error("Could not save the setting.");
    }
    return { isProfileOpen: data.isProfileOpen };
  });

/** Creator turns the reaction cam on or off for an existing share link. */
export const setVoteReactionEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ slug: z.string().min(4).max(40), reactionEnabled: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ reactionEnabled: boolean }> => {
    const { error } = await context.supabase
      .from("vote_sessions")
      .update({ reaction_enabled: data.reactionEnabled })
      .eq("slug", data.slug)
      .eq("creator_user_id", context.userId);
    if (error) {
      console.error("setVoteReactionEnabled failed", error);
      throw new Error("Could not save the setting.");
    }
    return { reactionEnabled: data.reactionEnabled };
  });

export type MyVoteSession = {
  slug: string;
  type: VoteSessionType;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  reactionEnabled: boolean;
  thumbnailUrl: string | null;
  tally: Record<VoteChoice, number>;
  total: number;
};

/** All votes created by the signed-in user, newest first. */
export const listMyVoteSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyVoteSession[]> => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("vote_sessions")
      .select("id, slug, type, caption, image_url_a, reaction_enabled, created_at, expires_at")
      .eq("creator_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const sessions = (rows ?? []) as {
      id: string;
      slug: string;
      type: string;
      caption: string | null;
      image_url_a: string;
      reaction_enabled: boolean;
      created_at: string;
      expires_at: string;
    }[];
    if (sessions.length === 0) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    return await Promise.all(
      sessions.map(async (s) => {
        const summary = await summarize(supabaseAdmin as never, s.id, true);
        let thumbnailUrl: string | null = null;
        if (/^https?:\/\//i.test(s.image_url_a)) thumbnailUrl = s.image_url_a;
        else {
          const res = await supabaseAdmin.storage
            .from("votes")
            .createSignedUrl(s.image_url_a, SIGNED_TTL);
          thumbnailUrl = res.data?.signedUrl ?? null;
        }
        return {
          slug: s.slug,
          type: s.type as VoteSessionType,
          caption: s.caption,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
          expired: new Date(s.expires_at).getTime() < Date.now(),
          reactionEnabled: s.reaction_enabled,
          thumbnailUrl,
          tally: summary.tally,
          total: summary.total,
        };
      }),
    );
  });
