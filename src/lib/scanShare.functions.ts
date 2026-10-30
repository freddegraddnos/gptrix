import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SharedScan = {
  ok: true;
  scanId: string;
  bodyPart: string | null;
  modelUrl: string;
  sketchUrl: string | null;
  note: string | null;
  /** cm per model unit – null when calibration failed. */
  scaleFactor: number | null;
  scaleConfidence: number | null;
  calibrated: boolean;
  expiresAt: string;
};

export type SharedScanError = { ok: false; reason: "not_found" | "expired" | "not_ready" };

const tokenSchema = z.object({ token: z.string().min(10).max(80) });

/** Creates (or reuses) a time-limited public link to a scan. */
export const createScanShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        scanId: z.string().uuid(),
        days: z.number().int().min(1).max(90).optional(),
        sketchPath: z.string().max(400).nullable().optional(),
        sketchBucket: z.string().max(60).nullable().optional(),
        note: z.string().max(300).nullable().optional(),
        artistId: z.string().uuid().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ token: string; expiresAt: string }> => {
    const { supabase, userId } = context;

    const { data: scan } = await supabase
      .from("body_scans")
      .select("id, status")
      .eq("id", data.scanId)
      .maybeSingle();
    if (!scan) throw new Error("Scan not found.");
    if (scan.status !== "ready") throw new Error("The 3D model isn't ready yet.");

    const days = data.days ?? 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabase.from("scan_shares").insert({
      scan_id: data.scanId,
      user_id: userId,
      token,
      sketch_path: data.sketchPath ?? null,
      sketch_bucket: data.sketchBucket ?? null,
      note: data.note ?? null,
      artist_id: data.artistId ?? null,
      expires_at: expiresAt,
    });
    if (error) {
      console.error("createScanShare failed", error);
      throw new Error("Could not create the share link.");
    }
    return { token, expiresAt };
  });

/** Public lookup of a shared scan via link code. */
export const getSharedScan = createServerFn({ method: "POST" })
  .inputValidator((raw) => tokenSchema.parse(raw))
  .handler(async ({ data }): Promise<SharedScan | SharedScanError> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: share } = await supabaseAdmin
      .from("scan_shares")
      .select("scan_id, sketch_path, sketch_bucket, note, expires_at, revoked")
      .eq("token", data.token)
      .maybeSingle();
    if (!share || share.revoked) return { ok: false, reason: "not_found" };
    if (new Date(share.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

    const { data: scan } = await supabaseAdmin
      .from("body_scans")
      .select("id, body_part, status, model_path, scale_factor, scale_confidence, calibrated")
      .eq("id", share.scan_id)
      .maybeSingle();
    if (!scan || scan.status !== "ready" || !scan.model_path) return { ok: false, reason: "not_ready" };

    const ttl = 60 * 60 * 6;
    const signed = await supabaseAdmin.storage.from("scans").createSignedUrl(scan.model_path, ttl);
    if (!signed.data?.signedUrl) return { ok: false, reason: "not_ready" };

    let sketchUrl: string | null = null;
    if (share.sketch_path) {
      const bucket = share.sketch_bucket ?? "scans";
      const s = await supabaseAdmin.storage.from(bucket).createSignedUrl(share.sketch_path, ttl);
      sketchUrl = s.data?.signedUrl ?? null;
    }

    return {
      ok: true,
      scanId: scan.id,
      bodyPart: scan.body_part,
      modelUrl: signed.data.signedUrl,
      sketchUrl,
      note: share.note,
      scaleFactor: scan.scale_factor === null ? null : Number(scan.scale_factor),
      scaleConfidence: scan.scale_confidence === null ? null : Number(scan.scale_confidence),
      calibrated: Boolean(scan.calibrated) && scan.scale_factor !== null,
      expiresAt: share.expires_at,
    };
  });
