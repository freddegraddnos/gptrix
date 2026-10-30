import { supabase } from "@/integrations/supabase/client";

const BUCKET = "studio";
const cache = new Map<string, string>();

/** Uploads a studio image (logo, artist photo, gallery shot) and returns its path. */
export async function uploadStudioImage(
  studioId: string,
  file: File,
  folder: "logo" | "team" | "gallery",
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${studioId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

/** Resolves a stored path (or passthrough URL) into a displayable URL. */
export async function studioImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:|^data:/.test(path)) return path;
  const hit = cache.get(path);
  if (hit) return hit;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (!data?.signedUrl) return null;
  cache.set(path, data.signedUrl);
  return data.signedUrl;
}

/** Resolves many paths at once, keyed by the original path. */
export async function studioImageUrls(
  paths: (string | null)[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    Array.from(new Set(paths.filter(Boolean) as string[])).map(async (p) => {
      const url = await studioImageUrl(p);
      if (url) out[p] = url;
    }),
  );
  return out;
}
