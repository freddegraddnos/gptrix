import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { useArtistMode } from "@/hooks/useArtistMode";
import { getStudioModules, saveStudioModules } from "@/lib/studioModules.functions";
import {
  DEFAULT_STUDIO_MODULES,
  normalizeStudioModules,
  type StudioModule,
} from "@/lib/studioModules";
import { supabase } from "@/integrations/supabase/client";

const CHANGE = "inksimulator:studio-modules-changed";

export function useStudioModules() {
  const { user } = useAuth();
  const { artist, loading: artistLoading, refresh: refreshArtist } = useArtistMode(user?.id);
  const [memberStudioId, setMemberStudioId] = useState<string | undefined>();
  useEffect(() => {
    let active = true;
    setMemberStudioId(undefined);
    if (user?.id)
      void supabase
        .from("studio_members")
        .select("studio_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("role", ["admin", "artist"])
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setMemberStudioId(data?.studio_id);
        });
    return () => {
      active = false;
    };
  }, [user?.id]);
  const studioId = artist?.user_id ?? memberStudioId;
  const read = useServerFn(getStudioModules);
  const write = useServerFn(saveStudioModules);
  const [enabled, setEnabled] = useState<StudioModule[]>(DEFAULT_STUDIO_MODULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setEnabled(DEFAULT_STUDIO_MODULES);
      setLoading(artistLoading);
      return;
    }
    setLoading(true);
    try {
      const result = await read({ data: { studioId } });
      setEnabled(normalizeStudioModules(result));
      setError(false);
    } catch {
      // Existing work remains accessible if preferences cannot be loaded.
      setEnabled(DEFAULT_STUDIO_MODULES);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [studioId, artistLoading, read]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const onChange = () => {
      void refreshArtist().then(refresh);
    };
    window.addEventListener(CHANGE, onChange);
    return () => window.removeEventListener(CHANGE, onChange);
  }, [refresh, refreshArtist]);

  const save = async (next: StudioModule[]) => {
    if (!studioId) throw new Error("No studio account");
    await write({ data: { studioId, enabled: next } });
    setEnabled(next);
    window.dispatchEvent(new Event(CHANGE));
  };
  return { enabled, loading, error, save };
}
