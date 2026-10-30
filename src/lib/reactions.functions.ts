import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SIGNED_TTL, decodeDataUrl } from "@/lib/reactions.server";

export type ReactionEntry = {
  id: string;
  url: string;
  mediaType: string;
  reactorName: string | null;
  choice: string | null;
  createdAt: string;
};

/** A recipient uploads their filmed reaction to a shared tattoo poll. */
export const submitReaction = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        slug: z.string().min(4).max(40),
        dataUrl: z.string().max(28_000_000),
        reactorName: z.string().max(60).nullable().optional(),
        choice: z.enum(["yes", "no", "a", "b"]).nullable().optional(),
        deviceId: z.string().max(80).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("vote_sessions")
      .select("id, creator_user_id, reaction_enabled, expires_at")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!session) throw new Error("This link is no longer available.");
    if (!session.reaction_enabled)
      throw new Error("Reactions are turned off for this link.");
    if (new Date(session.expires_at).getTime() < Date.now())
      throw new Error("This link has expired.");

    const { bytes, mime } = decodeDataUrl(data.dataUrl);
    const ext = mime.includes("mp4")
      ? "mp4"
      : mime.startsWith("image/")
        ? mime.split("/")[1]
        : "webm";
    const path = `${session.creator_user_id}/${session.id}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("reactions")
      .upload(path, new Blob([bytes.buffer as ArrayBuffer], { type: mime }), {
        contentType: mime,
        upsert: false,
      });
    if (upErr) {
      console.error("reaction upload failed", upErr);
      throw new Error("Could not upload the reaction.");
    }

    const { error } = await supabaseAdmin.from("vote_reactions").insert({
      vote_session_id: session.id,
      creator_user_id: session.creator_user_id,
      media_path: path,
      media_type: mime,
      reactor_name: data.reactorName?.trim() || null,
      choice: data.choice ?? null,
      device_id: data.deviceId ?? null,
    });
    if (error) {
      console.error("reaction insert failed", error);
      throw new Error("Could not save the reaction.");
    }
    return { ok: true };
  });

/** The poll creator lists the reactions they have received. */
export const listReactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ slug: z.string().min(4).max(40) }).parse(raw))
  .handler(async ({ data, context }): Promise<ReactionEntry[]> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabase
      .from("vote_sessions")
      .select("id, creator_user_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!session || session.creator_user_id !== userId) return [];

    const { data: rows } = await supabase
      .from("vote_reactions")
      .select("id, media_path, media_type, reactor_name, choice, created_at")
      .eq("vote_session_id", session.id)
      .order("created_at", { ascending: false });

    const out: ReactionEntry[] = [];
    for (const r of rows ?? []) {
      const signed = await supabaseAdmin.storage
        .from("reactions")
        .createSignedUrl(r.media_path, SIGNED_TTL);
      if (!signed.data?.signedUrl) continue;
      out.push({
        id: r.id,
        url: signed.data.signedUrl,
        mediaType: r.media_type,
        reactorName: r.reactor_name,
        choice: r.choice,
        createdAt: r.created_at,
      });
    }
    return out;
  });

/** Removes a reaction the creator received. */
export const deleteReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("vote_reactions")
      .select("id, media_path, creator_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.creator_user_id !== userId) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("reactions").remove([row.media_path]);
    await supabase.from("vote_reactions").delete().eq("id", data.id);
    return { ok: true };
  });
