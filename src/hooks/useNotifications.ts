import { useCallback, useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: "like" | "comment" | "follow" | "message" | "booking";
  post_id: string | null;
  conversation_id: string | null;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  actor_name: string | null;
  actor_avatar: string | null;
};

export function useNotifications(userId: string | undefined) {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: raw } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = raw ?? [];
    const actorIds = Array.from(
      new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v)),
    );
    const { data: profs } = actorIds.length
      ? await supabase
          .from("public_profiles")
          .select("id, display_name, avatar_url")
          .in("id", actorIds)
      : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    setItems(
      rows.map((r) => ({
        ...r,
        actor_name: r.actor_id ? map.get(r.actor_id)?.display_name ?? null : null,
        actor_avatar: r.actor_id ? map.get(r.actor_id)?.avatar_url ?? null : null,
      })) as Notification[],
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime new notifications
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh, instanceId]);

  const unread = items.filter((n) => !n.read_at).length;

  const markRead = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
      await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", id)
        .is("read_at", null);
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    setItems((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
    );
  }, [userId]);

  return { items, loading, unread, refresh, markRead, markAllRead };
}
