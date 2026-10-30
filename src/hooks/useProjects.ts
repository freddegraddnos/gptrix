import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SavedProject = {
  id: string;
  user_id: string;
  name: string;
  body_part: string | null;
  tattoo_id: string | null;
  tattoo_name: string | null;
  width_cm: number | null;
  preview_url: string | null;
  base_photo_url?: string | null;
  created_at: string;
};

export function useProjects(userId: string | undefined) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProjects([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setProjects((data ?? []) as SavedProject[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("projects").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  return { projects, loading, refresh, remove };
}

/** Uploads a PNG data URL to the private project-previews bucket and returns a signed URL. */
export async function uploadPreview(
  userId: string,
  dataUrl: string,
): Promise<{ path: string; signedUrl: string | null }> {
  const blob = await (await fetch(dataUrl)).blob();
  const filename = `${crypto.randomUUID()}.png`;
  const path = `${userId}/${filename}`;
  const { error } = await supabase.storage
    .from("project-previews")
    .upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage
    .from("project-previews")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signError || !data?.signedUrl) {
    await supabase.storage.from("project-previews").remove([path]).catch(() => undefined);
    throw signError ?? new Error("Could not prepare the saved image");
  }
  return { path, signedUrl: data.signedUrl };
}

export async function saveProject(input: {
  /** Reuse for recovery retries; never overwrite a previously saved project. */
  projectId?: string;
  userId: string;
  name: string;
  bodyPart?: string;
  tattooId?: string;
  tattooName?: string;
  widthCm?: number;
  previewDataUrl?: string;
  /** Same photo without the design, for the studio. */
  basePhotoDataUrl?: string;
}) {
  if (input.projectId) {
    const { data: existing, error } = await supabase.from("projects").select("*").eq("id", input.projectId).eq("user_id", input.userId).maybeSingle();
    if (error) throw error;
    if (existing) return existing;
  }
  let previewUrl: string | null = null;
  let basePhotoUrl: string | null = null;
  const uploadedPaths: string[] = [];
  try {
    if (input.basePhotoDataUrl) {
      const image = await uploadPreview(input.userId, input.basePhotoDataUrl);
      uploadedPaths.push(image.path);
      basePhotoUrl = image.signedUrl;
    }
    if (input.previewDataUrl) {
      const image = await uploadPreview(input.userId, input.previewDataUrl);
      uploadedPaths.push(image.path);
      previewUrl = image.signedUrl;
    }
  } catch (error) {
    // No project has been inserted yet, so these uploads are safe to discard.
    if (uploadedPaths.length) await supabase.storage.from("project-previews").remove(uploadedPaths).catch(() => undefined);
    throw error;
  }
  const { data, error } = await supabase
    .from("projects")
    .insert({
      ...(input.projectId ? { id: input.projectId } : {}),
      user_id: input.userId,
      name: input.name,
      body_part: input.bodyPart ?? null,
      tattoo_id: input.tattooId ?? null,
      tattoo_name: input.tattooName ?? null,
      width_cm: input.widthCm ?? null,
      preview_url: previewUrl,
      base_photo_url: basePhotoUrl,
    })
    .select()
    .single();
  if (error) {
    // Two tabs may finish the same recovery; keep the first immutable snapshot.
    if (error.code === "23505" && input.projectId) {
      const { data: existing, error: readError } = await supabase.from("projects").select("*").eq("id", input.projectId).eq("user_id", input.userId).single();
      if (!readError && existing) return existing;
    }
    throw error;
  }
  return data;
}
