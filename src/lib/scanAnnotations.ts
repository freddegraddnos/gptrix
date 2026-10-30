import { supabase } from "@/integrations/supabase/client";
import type { ScanAnnotation } from "@/components/Model3DViewer";

type TokenRow = {
  id: string;
  author_name: string | null;
  body: string;
  x: number;
  y: number;
  z: number;
  created_at: string;
};

/** Notes on a scan the signed-in user owns. */
export async function listOwnAnnotations(scanId: string): Promise<ScanAnnotation[]> {
  const { data } = await supabase
    .from("scan_annotations")
    .select("id, body, author_name, pos_x, pos_y, pos_z, created_at")
    .eq("scan_id", scanId)
    .order("created_at");
  return (data ?? []).map((r) => ({
    id: r.id,
    body: r.body,
    authorName: r.author_name,
    x: Number(r.pos_x),
    y: Number(r.pos_y),
    z: Number(r.pos_z),
    createdAt: r.created_at,
  }));
}

export async function addOwnAnnotation(
  scanId: string,
  point: { x: number; y: number; z: number },
  body: string,
  authorName?: string | null,
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to add notes.");
  const { error } = await supabase.from("scan_annotations").insert({
    scan_id: scanId,
    author_user_id: auth.user.id,
    author_name: authorName ?? null,
    body: body.slice(0, 1000),
    pos_x: point.x,
    pos_y: point.y,
    pos_z: point.z,
  });
  if (error) throw error;
}

export async function deleteAnnotation(id: string) {
  const { error } = await supabase.from("scan_annotations").delete().eq("id", id);
  if (error) throw error;
}

/** Notes visible through a share link (studio side, no login required). */
export async function listAnnotationsByToken(token: string): Promise<ScanAnnotation[]> {
  const { data } = await supabase.rpc("scan_annotations_by_token", { _token: token });
  const rows = (data ?? []) as unknown as TokenRow[];
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    authorName: r.author_name,
    x: Number(r.x),
    y: Number(r.y),
    z: Number(r.z),
    createdAt: r.created_at,
  }));
}

export async function addAnnotationByToken(
  token: string,
  point: { x: number; y: number; z: number },
  body: string,
  name?: string | null,
) {
  const { data, error } = await supabase.rpc("add_scan_annotation", {
    _token: token,
    _name: name ?? "",
    _body: body,
    _x: point.x,
    _y: point.y,
    _z: point.z,
  });
  if (error) throw error;
  const res = data as unknown as { ok: boolean; error?: string };
  if (!res?.ok) throw new Error(res?.error ?? "Could not save the note.");
}

/** Saves a manual calibration (cm per model unit) for a scan the user owns. */
export async function saveScanScale(scanId: string, scaleFactor: number) {
  const { data, error } = await supabase.rpc("set_scan_scale", {
    _scan_id: scanId,
    _scale: scaleFactor,
  });
  if (error) throw error;
  const res = data as unknown as { ok: boolean; error?: string };
  if (!res?.ok) throw new Error(res?.error ?? "Could not save the calibration.");
}
