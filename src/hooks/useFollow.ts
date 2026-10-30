import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useFollow(currentUserId: string | undefined, targetUserId: string | undefined) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      setFollowing(false);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUserId)
      .eq("following_id", targetUserId)
      .maybeSingle();
    setFollowing(!!data);
    setLoading(false);
  }, [currentUserId, targetUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;
    const next = !following;
    setFollowing(next); // optimistic
    if (next) {
      await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      });
    } else {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId);
    }
  }, [currentUserId, targetUserId, following]);

  return { following, loading, toggle };
}

export function useFollowingIds(userId: string | undefined) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    if (!userId) {
      setIds([]);
      return;
    }
    let alive = true;
    void supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .then(({ data }) => {
        if (alive) setIds((data ?? []).map((r) => r.following_id));
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  return ids;
}
