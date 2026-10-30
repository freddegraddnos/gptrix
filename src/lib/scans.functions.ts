import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScanListItem = {
  id: string;
  bodyPart: string | null;
  status: string;
  calibrated: boolean;
  scaleFactor: number | null;
  createdAt: string;
  modelUrl: string | null;
  /** Flat still frame from the scan — used as a drawing reference. */
  stillUrl?: string | null;
};


/** All 3D scans for the logged-in user, with signed model URLs. */
export const listMyScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScanListItem[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("body_scans")
      .select("id, body_part, status, calibrated, scale_factor, created_at, model_path")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("listMyScans failed", error);
      throw new Error("Could not fetch your scans.");
    }

    const out: ScanListItem[] = [];
    for (const row of data ?? []) {
      let modelUrl: string | null = null;
      if (row.model_path) {
        const signed = await supabase.storage
          .from("scans")
          .createSignedUrl(row.model_path, 60 * 60);
        modelUrl = signed.data?.signedUrl ?? null;
      }
      out.push({
        id: row.id,
        bodyPart: row.body_part,
        status: row.status,
        calibrated: row.calibrated,
        scaleFactor: row.scale_factor === null ? null : Number(row.scale_factor),
        createdAt: row.created_at,
        modelUrl,
      });
    }
    return out;
  });

/** En enskild scanning med signerad modell-URL. */
export const getMyScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ scanId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<ScanListItem | null> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("body_scans")
      .select(
        "id, body_part, status, calibrated, scale_factor, created_at, model_path, still_path",
      )
      .eq("id", data.scanId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) return null;
    let modelUrl: string | null = null;
    if (row.model_path) {
      const signed = await supabase.storage
        .from("scans")
        .createSignedUrl(row.model_path, 60 * 60);
      modelUrl = signed.data?.signedUrl ?? null;
    }
    let stillUrl: string | null = null;
    if (row.still_path) {
      const signed = await supabase.storage
        .from("scans")
        .createSignedUrl(row.still_path, 60 * 60);
      stillUrl = signed.data?.signedUrl ?? null;
    }
    return {
      id: row.id,
      bodyPart: row.body_part,
      status: row.status,
      calibrated: row.calibrated,
      scaleFactor: row.scale_factor === null ? null : Number(row.scale_factor),
      createdAt: row.created_at,
      modelUrl,
      stillUrl,
    };
  });



/** Saves a manually calibrated cm-per-unit factor for a scan. */
export const updateScanScale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ scanId: z.string().uuid(), scaleFactor: z.number().positive() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("body_scans")
      .update({ scale_factor: data.scaleFactor, calibrated: true })
      .eq("id", data.scanId)
      .eq("user_id", userId);
    if (error) {
      console.error("updateScanScale failed", error);
      throw new Error("Could not save the calibration.");
    }
    return { ok: true };
  });
