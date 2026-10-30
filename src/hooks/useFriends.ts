/**
 * Friends: requests, accepted friends and handle search.
 *
 * Contact-book import is not available to a web app, so friends are found by
 * InkSimulator handle or added through a share link.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FriendRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
};

export type FriendProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type Friend = {
  /** friendship row id */
  rowId: string;
  status: string;
  /** true when the signed-in user sent the request */
  outgoing: boolean;
  profile: FriendProfile;
};

async function loadProfiles(ids: string[]): Promise<Map<string, FriendProfile>> {
  const map = new Map<string, FriendProfile>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .in("id", ids);
  for (const p of data ?? []) map.set(p.id, p as FriendProfile);
  return map;
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as FriendRow[];
    const others = rows.map((r) =>
      r.requester_id === user.id ? r.addressee_id : r.requester_id,
    );
    const profiles = await loadProfiles(others);
    setFriends(
      rows.map((r) => {
        const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
        return {
          rowId: r.id,
          status: r.status,
          outgoing: r.requester_id === user.id,
          profile:
            profiles.get(otherId) ??
            ({ id: otherId, handle: null, display_name: null, avatar_url: null } as FriendProfile),
        };
      }),
    );
    setError(null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const request = useCallback(
    async (addresseeId: string) => {
      if (!user) throw new Error("Sign in to add friends");
      const { error: err } = await supabase
        .from("friendships")
        .insert({ requester_id: user.id, addressee_id: addresseeId });
      if (err) throw err;
      await refresh();
    },
    [user, refresh],
  );

  const accept = useCallback(
    async (rowId: string) => {
      const { error: err } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", rowId);
      if (err) throw err;
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (rowId: string) => {
      const { error: err } = await supabase.from("friendships").delete().eq("id", rowId);
      if (err) throw err;
      await refresh();
    },
    [refresh],
  );

  const search = useCallback(
    async (q: string): Promise<FriendProfile[]> => {
      const term = q.trim();
      if (term.length < 2) return [];
      const { data, error: err } = await supabase.rpc("search_user_handles", { _q: term });
      if (err) throw err;
      return ((data ?? []) as FriendProfile[]).filter((p) => p.id !== user?.id);
    },
    [user],
  );

  return {
    friends,
    accepted: friends.filter((f) => f.status === "accepted"),
    incoming: friends.filter((f) => f.status === "pending" && !f.outgoing),
    outgoing: friends.filter((f) => f.status === "pending" && f.outgoing),
    loading,
    error,
    signedIn: !!user,
    refresh,
    request,
    accept,
    remove,
    search,
  };
}
