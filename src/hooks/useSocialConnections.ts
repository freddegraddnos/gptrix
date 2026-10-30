import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeUsername,
  platformInfo,
  type SocialPlatform,
} from "@/lib/socialAccounts";

export type SocialConnection = {
  id: string;
  platform: SocialPlatform;
  username: string | null;
  profile_url: string | null;
  is_public: boolean;
  method: string;
};

/** The user's connected social accounts (X, Facebook, Instagram, Snapchat). */
export function useSocialConnections(userId?: string) {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setConnections([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("social_connections")
      .select("id, platform, username, profile_url, is_public, method")
      .eq("user_id", userId);
    setConnections((data ?? []) as SocialConnection[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const connect = useCallback(
    async (platform: SocialPlatform, rawUsername: string) => {
      if (!userId) return { error: "Log in first" };
      const username = normalizeUsername(rawUsername);
      if (!username) return { error: "Enter your username" };
      const info = platformInfo(platform);
      const { error } = await supabase.from("social_connections").upsert(
        {
          user_id: userId,
          platform,
          username,
          profile_url: info?.profileUrl(username) ?? null,
          method: "manual",
        },
        { onConflict: "user_id,platform" },
      );
      await reload();
      return { error: error?.message ?? null };
    },
    [userId, reload],
  );

  const setPublic = useCallback(
    async (platform: SocialPlatform, isPublic: boolean) => {
      if (!userId) return;
      setConnections((prev) =>
        prev.map((c) => (c.platform === platform ? { ...c, is_public: isPublic } : c)),
      );
      await supabase
        .from("social_connections")
        .update({ is_public: isPublic })
        .eq("user_id", userId)
        .eq("platform", platform);
    },
    [userId],
  );

  const disconnect = useCallback(
    async (platform: SocialPlatform) => {
      if (!userId) return;
      setConnections((prev) => prev.filter((c) => c.platform !== platform));
      await supabase
        .from("social_connections")
        .delete()
        .eq("user_id", userId)
        .eq("platform", platform);
    },
    [userId],
  );

  return { connections, loading, connect, setPublic, disconnect, reload };
}
