import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapProjectRow, type IdeaContext } from "@/lib/ideaContext";

/** Loads one of the signed-in customer's own ideas (RLS limits it to the owner). */
export function useIdea(ideaId: string | null | undefined, userId: string | undefined) {
  const [idea, setIdea] = useState<IdeaContext | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!ideaId || !userId) {
      setIdea(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", ideaId).eq("user_id", userId).maybeSingle();
      let urls: string[] = [];
      const ids = (data?.shared_reference_ids ?? []) as string[];
      if (ids.length) {
        const { data: refs } = await supabase.from("project_assets").select("id,image_url").in("id", ids).eq("user_id", userId);
        urls = (refs ?? []).map((r) => r.image_url);
      }
      if (!cancelled) {
        setIdea(data ? mapProjectRow(data as Record<string, unknown>, urls) : null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ideaId, userId]);
  return { idea, loading };
}
