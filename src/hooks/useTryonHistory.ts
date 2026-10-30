import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadPreview } from "@/hooks/useProjects";

export type TryonEntry = {
  id: string;
  user_id: string;
  motif_id: string | null;
  motif_name: string | null;
  body_part: string | null;
  pose: string | null;
  width_cm: number | null;
  rotation: number | null;
  preview_url: string | null;
  session_id: string | null;
  created_at: string;
};

export function useTryonHistory(userId: string | undefined) {
  const [entries, setEntries] = useState<TryonEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("tryon_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    setEntries((data ?? []) as TryonEntry[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      await supabase.from("tryon_history").delete().eq("id", id);
    },
    [],
  );

  return { entries, loading, refresh, remove };
}

/** Saves an AR try-on (motif + placement + size + timestamp). */
export async function saveTryon(input: {
  userId: string;
  motifId?: string;
  motifName?: string;
  bodyPart?: string;
  pose?: string;
  widthCm?: number;
  rotation?: number;
  transform?: unknown;
  sessionId?: string;
  previewDataUrl?: string;
}) {
  let previewUrl: string | null = null;
  if (input.previewDataUrl) {
    try {
      const { signedUrl } = await uploadPreview(
        input.userId,
        input.previewDataUrl,
      );
      previewUrl = signedUrl;
    } catch (e) {
      console.warn("tryon preview upload failed", e);
    }
  }
  const { data, error } = await supabase
    .from("tryon_history")
    .insert({
      user_id: input.userId,
      motif_id: input.motifId ?? null,
      motif_name: input.motifName ?? null,
      body_part: input.bodyPart ?? null,
      pose: input.pose ?? null,
      width_cm: input.widthCm ?? null,
      rotation: input.rotation ?? null,
      transform: (input.transform ?? null) as never,
      session_id: input.sessionId ?? null,
      preview_url: previewUrl,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TryonEntry;
}
