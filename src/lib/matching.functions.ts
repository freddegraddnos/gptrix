/**
 * "Matching tattoos" — share a design with a partner or friend so they open
 * the exact same motif (and, if you tick the box, the exact same size).
 *
 * The motif is stored as a transparent PNG data URL so it works for library
 * motifs as well as anything made in the drawing tool, the text tool or the
 * AI generator.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MatchingDesign = {
  ok: true;
  token: string;
  name: string;
  image: string;
  /** Present only when the sender chose to share the same size. */
  widthCm: number | null;
  rotation: number | null;
  message: string | null;
  senderName: string | null;
  expiresAt: string;
};

export type MatchingDesignError = { ok: false; reason: "not_found" | "expired" };

/** ~3 MB of base64 — plenty for a stencil PNG, small enough for one row. */
const MAX_IMAGE_CHARS = 3_000_000;

const makeToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 24);

export const createMatchingDesign = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        name: z.string().trim().min(1).max(80).default("Matching design"),
        image: z
          .string()
          .max(MAX_IMAGE_CHARS)
          .refine((v) => v.startsWith("data:image/"), "Only image data is allowed"),
        widthCm: z.number().positive().max(200).nullable().optional(),
        rotation: z.number().min(-360).max(360).nullable().optional(),
        message: z.string().trim().max(280).nullable().optional(),
        senderName: z.string().trim().max(60).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ token: string; expiresAt: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = makeToken();

    const { data: row, error } = await supabaseAdmin
      .from("matching_designs")
      .insert({
        token,
        name: data.name,
        image_data: data.image,
        width_cm: data.widthCm ?? null,
        rotation: data.rotation ?? null,
        message: data.message || null,
        sender_name: data.senderName || null,
      })
      .select("token, expires_at")
      .single();

    if (error || !row) throw new Error("Could not create the matching link.");
    return { token: row.token, expiresAt: row.expires_at };
  });

export const getMatchingDesign = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ token: z.string().min(6).max(80) }).parse(raw))
  .handler(async ({ data }): Promise<MatchingDesign | MatchingDesignError> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("matching_designs")
      .select("token, name, image_data, width_cm, rotation, message, sender_name, expires_at, opened_count")
      .eq("token", data.token)
      .maybeSingle();

    if (!row) return { ok: false, reason: "not_found" };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, reason: "expired" };
    }

    void supabaseAdmin
      .from("matching_designs")
      .update({ opened_count: (row.opened_count ?? 0) + 1 })
      .eq("token", row.token);

    return {
      ok: true,
      token: row.token,
      name: row.name,
      image: row.image_data,
      widthCm: row.width_cm != null ? Number(row.width_cm) : null,
      rotation: row.rotation != null ? Number(row.rotation) : null,
      message: row.message,
      senderName: row.sender_name,
      expiresAt: row.expires_at,
    };
  });
