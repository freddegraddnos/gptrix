import { supabase } from "@/integrations/supabase/client";
import { getBookingFileUrl } from "@/lib/bookingScan.functions";

/** Delivery groups tracked with their own version counter. */
export type FileKind = "model" | "svg" | "measurements" | "pdf" | "image" | "project" | "other";

export type BookingFile = {
  id: string;
  name: string;
  path: string;
  bucket: string;
  size_bytes: number | null;
  uploader_id: string;
  uploader_role: string;
  created_at: string;
  /** 1-based delivery version inside its own group (3D or 2D). */
  version: number;
  is3d: boolean;
  /** Fine-grained delivery group (1:1 SVG, measurement image, PDF, model…). */
  kind: FileKind;
  /** 1-based version inside the fine-grained group. */
  kindVersion: number;
};

const MODEL_EXT = /\.(glb|gltf)$/i;
const THREE_D_EXT = /\.(glb|gltf|obj|stl|usdz|ply|fbx)$/i;

export function is3dFile(name: string) {
  return THREE_D_EXT.test(name);
}

/** Only glb/gltf can be shown inline in the web 3D viewer. */
export function isViewableModel(name: string) {
  return MODEL_EXT.test(name);
}

/** Full drawing-studio state (layer stack, sizes) saved next to the artwork. */
export function isPaintProject(name: string) {
  return /\.inkproj\.json$/i.test(name);
}

export function fileKind(name: string): FileKind {
  if (isPaintProject(name)) return "project";
  if (is3dFile(name)) return "model";
  if (/\.svg$/i.test(name)) return "svg";
  if (/measure|dimension|mm/i.test(name) && /\.(png|jpe?g|webp)$/i.test(name)) return "measurements";
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.(png|jpe?g|webp|gif)$/i.test(name)) return "image";
  return "other";
}

export const KIND_LABEL: Record<FileKind, string> = {
  model: "3D",
  svg: "1:1 SVG",
  measurements: "Measurements",
  pdf: "PDF",
  image: "Image",
  project: "Artwork project",
  other: "File",
};

/** Files that can be shown inline (flat preview) in the timeline. */
export function isPreviewable(name: string) {
  return /\.(svg|png|jpe?g|webp|gif)$/i.test(name);
}

export function prettyBytes(bytes: number | null) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * All files shared around one booking, newest first, with a delivery version
 * number per group so both sides can see which update is the latest.
 */
export async function listBookingFiles(slotId: string): Promise<BookingFile[]> {
  const { data } = await supabase
    .from("booking_files")
    .select("id, name, path, bucket, size_bytes, uploader_id, uploader_role, created_at")
    .eq("slot_id", slotId)
    .order("created_at", { ascending: true });

  let v3d = 0;
  let v2d = 0;
  const perKind: Partial<Record<FileKind, number>> = {};
  const withVersions = (data ?? []).map((row) => {
    const is3d = is3dFile(row.name);
    const version = is3d ? ++v3d : ++v2d;
    const kind = fileKind(row.name);
    const kindVersion = (perKind[kind] = (perKind[kind] ?? 0) + 1);
    return { ...row, is3d, version, kind, kindVersion } as BookingFile;
  });
  return withVersions.reverse();
}

/** Next version number a new upload of this kind will get. */
export function nextVersion(files: BookingFile[], is3d: boolean) {
  return files.filter((f) => f.is3d === is3d).length + 1;
}

/** Next version inside a fine-grained delivery group. */
export function nextKindVersion(files: BookingFile[], kind: FileKind) {
  return files.filter((f) => f.kind === kind).length + 1;
}


/** Short-lived signed URL for one booking file. */
export async function bookingFileUrl(fileId: string) {
  const res = await getBookingFileUrl({ data: { fileId } });
  if (!res.ok) throw new Error(res.reason);
  return res;
}

/**
 * Bundles every file on a booking (3D models and 2D artwork) into one zip and
 * triggers the download in the browser.
 */
export async function downloadBookingBundle(slotId: string, files?: BookingFile[]) {
  const list = files ?? (await listBookingFiles(slotId));
  if (list.length === 0) throw new Error("no_files");

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const models = zip.folder("3d");
  const art = zip.folder("2d");

  for (const f of list) {
    const signed = await bookingFileUrl(f.id);
    const blob = await fetch(signed.url).then((r) => r.blob());
    const folder = (f.is3d ? models : art) ?? zip;
    folder.file(`v${f.version}-${f.name}`, blob);
  }

  const out = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inksimulator-booking-${slotId.slice(0, 8)}-files.zip`;
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return list.length;
}
