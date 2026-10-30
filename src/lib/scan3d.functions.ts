import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createInput = z.object({
  bodyPart: z.string().max(40).nullable().optional(),
  videoPath: z.string().min(3),
  stillPath: z.string().min(3).nullable().optional(),
  scaleFactor: z.number().positive().nullable().optional(),
  scaleConfidence: z.number().min(0).max(1).nullable().optional(),
});

export type ScanResult = {
  id: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  modelUrl: string | null;
  scaleFactor: number | null;
  scaleConfidence: number | null;
  calibrated: boolean;
  error: string | null;
};

/** Creates the scan record after the client has uploaded video + still image. */
export const createScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => createInput.parse(raw))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("body_scans")
      .insert({
        user_id: userId,
        body_part: data.bodyPart ?? null,
        video_path: data.videoPath,
        still_path: data.stillPath ?? null,
        scale_factor: data.scaleFactor ?? null,
        scale_confidence: data.scaleConfidence ?? null,
        calibrated: (data.scaleConfidence ?? 0) >= 0.5,
        status: "uploaded",
      })
      .select("id")
      .single();
    if (error) {
      console.error("createScan failed", error);
      throw new Error("Could not save the scan.");
    }
    return { id: row.id };
  });

/** Sends the video to KIRI Engine in video-scan mode. */
export const startScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ scanId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<ScanResult> => {
    const apiKey = process.env["KIRI_ENGINE_API_KEY"];
    const { supabase } = context;
    const { data: scan } = await supabase
      .from("body_scans")
      .select("*")
      .eq("id", data.scanId)
      .single();
    if (!scan) throw new Error("Scan not found.");
    if (!apiKey) {
      await supabase
        .from("body_scans")
        .update({ status: "failed", error_code: "no_api_key", error_message: "The 3D service is not configured." })
        .eq("id", scan.id);
      return toResult(scan.id, "failed", null, scan, "The 3D service is not configured right now.");
    }

    const file = await supabase.storage.from("scans").download(scan.video_path);
    if (file.error || !file.data) {
      console.error("startScan download failed", file.error);
      throw new Error("Could not read the scan video.");
    }

    try {
      const { uploadVideoScan } = await import("./kiri.server");
      const serialize = await uploadVideoScan(apiKey, file.data, "scan.mp4");
      await supabase
        .from("body_scans")
        .update({ provider_task_id: serialize, status: "processing", error_code: null, error_message: null })
        .eq("id", scan.id);
      return toResult(scan.id, "processing", null, scan, null);
    } catch (e) {
      const message = (e as Error).message;
      console.error("startScan kiri upload failed", message);
      await supabase
        .from("body_scans")
        .update({ status: "failed", error_code: "upload_failed", error_message: message.slice(0, 400) })
        .eq("id", scan.id);
      return toResult(
        scan.id,
        "failed",
        null,
        scan,
        "The video could not be sent to the 3D service. Try re-scanning with steadier movement.",
      );
    }
  });

/** Polls KIRI, fetches the .glb, scales it and saves it in the user's folder. */
export const pollScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ scanId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<ScanResult> => {
    const apiKey = process.env["KIRI_ENGINE_API_KEY"];
    const { supabase, userId } = context;
    const { data: scan } = await supabase
      .from("body_scans")
      .select("*")
      .eq("id", data.scanId)
      .single();
    if (!scan) throw new Error("Scan not found.");

    if (scan.status === "ready" && scan.model_path) {
      const signed = await supabase.storage.from("scans").createSignedUrl(scan.model_path, 60 * 60);
      return toResult(scan.id, "ready", signed.data?.signedUrl ?? null, scan, null);
    }
    if (scan.status === "failed") {
      return toResult(scan.id, "failed", null, scan, scan.error_message ?? "The scan failed.");
    }
    if (!apiKey || !scan.provider_task_id) {
      return toResult(scan.id, "processing", null, scan, null);
    }

    const { getScanStatus, getModelZipUrl } = await import("./kiri.server");
    let status;
    try {
      status = await getScanStatus(apiKey, scan.provider_task_id);
    } catch (e) {
      console.error("pollScan status failed", (e as Error).message);
      return toResult(scan.id, "processing", null, scan, null);
    }

    if (status.state === "processing") {
      return toResult(scan.id, "processing", null, scan, null);
    }
    if (status.state === "failed") {
      await supabase
        .from("body_scans")
        .update({ status: "failed", error_code: "reconstruction_failed", error_message: status.message })
        .eq("id", scan.id);
      return toResult(scan.id, "failed", null, scan, status.message);
    }

    try {
      const zipUrl = await getModelZipUrl(apiKey, scan.provider_task_id);
      const res = await fetch(zipUrl);
      if (!res.ok) throw new Error(`download_failed:${res.status}`);
      const zipBytes = new Uint8Array(await res.arrayBuffer());

      const { unzipSync } = await import("fflate");
      const files = unzipSync(zipBytes);
      const glbName = Object.keys(files).find((n) => n.toLowerCase().endsWith(".glb"));
      if (!glbName) throw new Error("no_glb_in_zip");

      let glb: Uint8Array<ArrayBufferLike> = files[glbName];
      const factor = Number(scan.scale_factor ?? 0);
      if (factor > 0) {
        const { applyGlbScale } = await import("./glbScale.server");
        glb = applyGlbScale(glb, factor);
      }

      const modelPath = `${userId}/${scan.id}/model.glb`;
      const up = await supabase.storage
        .from("scans")
        .upload(modelPath, new Blob([glb.buffer as ArrayBuffer], { type: "model/gltf-binary" }), {
          upsert: true,
          contentType: "model/gltf-binary",
        });
      if (up.error) throw new Error(`storage:${up.error.message}`);

      await supabase
        .from("body_scans")
        .update({ status: "ready", model_path: modelPath, error_code: null, error_message: null })
        .eq("id", scan.id);

      const signed = await supabase.storage.from("scans").createSignedUrl(modelPath, 60 * 60);
      return toResult(scan.id, "ready", signed.data?.signedUrl ?? null, scan, null);
    } catch (e) {
      const message = (e as Error).message;
      console.error("pollScan finalize failed", message);
      await supabase
        .from("body_scans")
        .update({ status: "failed", error_code: "finalize_failed", error_message: message.slice(0, 400) })
        .eq("id", scan.id);
      return toResult(
        scan.id,
        "failed",
        null,
        scan,
        "The 3D model could not be finalized. Try re-scanning with steadier lighting and movement.",
      );
    }
  });

function toResult(
  id: string,
  status: ScanResult["status"],
  modelUrl: string | null,
  scan: { scale_factor: number | null; scale_confidence: number | null; calibrated: boolean },
  error: string | null,
): ScanResult {
  return {
    id,
    status,
    modelUrl,
    scaleFactor: scan.scale_factor === null ? null : Number(scan.scale_factor),
    scaleConfidence: scan.scale_confidence === null ? null : Number(scan.scale_confidence),
    calibrated: scan.calibrated,
    error,
  };
}
