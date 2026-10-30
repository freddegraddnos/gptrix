import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type InstagramMessage = {
  id: string;
  direction: "in" | "out";
  body: string | null;
  attachment_url: string | null;
  created_at: string;
  ai_time: { found?: boolean; startsAt?: string | null; label?: string | null; durationMinutes?: number | null } | null;
  ai_checked_at: string | null;
};

export type InboxThread = {
  id: string;
  source: "instagram" | "inkvision";
  name: string;
  handle: string | null;
  avatar: string | null;
  lastMessageAt: string;
  preview: string;
  unread: boolean;
  projectId: string | null;
  /** Instagram only: DM replies are allowed for 24 h after the last inbound message. */
  windowExpiresAt: string | null;
};

function windowFrom(lastInbound: string | null) {
  if (!lastInbound) return null;
  return new Date(new Date(lastInbound).getTime() + 24 * 3600_000).toISOString();
}

export function useStudioInbox(studioId: string | undefined) {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [igResult, projectResult] = await Promise.all([
      supabase
        .from("instagram_threads")
        .select("id, participant_name, participant_username, participant_avatar, last_message_at, last_inbound_at, unread_count, project_id")
        .eq("studio_id", studioId)
        .order("last_message_at", { ascending: false })
        .limit(100),
      supabase
        .from("artist_client_projects")
        .select("id, title, conversation_title, client_name, latest_activity_at, status, studio_read_at")
        .eq("artist_id", studioId)
        .order("latest_activity_at", { ascending: false })
        .limit(100),
    ]);

    const igThreads: InboxThread[] = (igResult.data ?? []).map((row) => ({
      id: row.id,
      source: "instagram",
      name: row.participant_name ?? row.participant_username ?? "Instagram user",
      handle: row.participant_username ? `@${row.participant_username}` : null,
      avatar: row.participant_avatar,
      lastMessageAt: row.last_message_at,
      preview: "",
      unread: (row.unread_count ?? 0) > 0,
      projectId: row.project_id,
      windowExpiresAt: windowFrom(row.last_inbound_at),
    }));

    const projectThreads: InboxThread[] = (projectResult.data ?? []).map((row) => ({
      id: row.id,
      source: "inkvision",
      name: row.conversation_title || row.client_name || row.title,
      handle: row.status,
      avatar: null,
      lastMessageAt: row.latest_activity_at,
      preview: row.title,
      unread: !row.studio_read_at,
      projectId: row.id,
      windowExpiresAt: null,
    }));

    setThreads(
      [...igThreads, ...projectThreads].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
      ),
    );
    setLoading(false);
  }, [studioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { threads, loading, refresh };
}

export async function loadInstagramMessages(threadId: string) {
  const { data } = await supabase
    .from("instagram_messages")
    .select("id, direction, body, attachment_url, created_at, ai_time, ai_checked_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data ?? []) as unknown as InstagramMessage[];
}
