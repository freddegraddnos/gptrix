import { useCallback, useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyNewMessage } from "@/lib/messages.functions";

export type Conversation = {
  id: string;
  last_message_at: string;
  other_id: string;
  other_name: string | null;
  other_avatar: string | null;
  last_body: string | null;
  unread: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment_path: string | null;
};

/** Find-or-create a direct 1:1 conversation between two users. */
export async function openDirectConversation(
  currentUserId: string,
  otherUserId: string,
): Promise<string> {
  // Finding or creating the 1:1 conversation happens server-side so nobody can
  // add themselves to a conversation they were not part of.
  void currentUserId;
  const { data, error } = await supabase.rpc("open_direct_conversation", {
    _other: otherUserId,
  });
  if (error || !data) throw error ?? new Error("Could not open the conversation");
  return data as string;
}

export function useConversations(userId: string | undefined) {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: myMemberships } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId);
    const convIds = (myMemberships ?? []).map((m) => m.conversation_id);
    if (convIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    const readMap = new Map(
      (myMemberships ?? []).map((m) => [m.conversation_id, m.last_read_at]),
    );
    const [{ data: convs }, { data: members }, { data: lastMessages }] =
      await Promise.all([
        supabase
          .from("conversations")
          .select("id, last_message_at")
          .in("id", convIds)
          .order("last_message_at", { ascending: false }),
        supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .in("conversation_id", convIds)
          .neq("user_id", userId),
        supabase
          .from("messages")
          .select("conversation_id, body, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false }),
      ]);
    const otherByConv = new Map<string, string>();
    for (const m of members ?? []) {
      if (!otherByConv.has(m.conversation_id))
        otherByConv.set(m.conversation_id, m.user_id);
    }
    const lastByConv = new Map<string, { body: string; created_at: string }>();
    for (const m of lastMessages ?? []) {
      if (!lastByConv.has(m.conversation_id))
        lastByConv.set(m.conversation_id, { body: m.body, created_at: m.created_at });
    }
    const otherIds = Array.from(new Set(otherByConv.values()));
    const { data: profs } = otherIds.length
      ? await supabase
          .from("public_profiles")
          .select("id, display_name, avatar_url")
          .in("id", otherIds)
      : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    setItems(
      (convs ?? []).map((c) => {
        const other = otherByConv.get(c.id) ?? "";
        const prof = profMap.get(other);
        const last = lastByConv.get(c.id);
        const lastRead = readMap.get(c.id);
        return {
          id: c.id,
          last_message_at: c.last_message_at,
          other_id: other,
          other_name: prof?.display_name ?? null,
          other_avatar: prof?.avatar_url ?? null,
          last_body: last?.body ?? null,
          unread:
            !!last &&
            (!lastRead || new Date(last.created_at) > new Date(lastRead)),
        };
      }),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime: refresh list on any new message
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`inbox:${userId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId, refresh, instanceId]);

  return { items, loading, refresh };
}

export function useThread(conversationId: string | undefined, userId: string | undefined) {
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [other, setOther] = useState<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Load other member profile
  useEffect(() => {
    if (!conversationId || !userId) return;
    let alive = true;
    (async () => {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", userId)
        .limit(1);
      const otherId = members?.[0]?.user_id;
      if (!otherId) return;
      const { data: prof } = await supabase
        .from("public_profiles")
        .select("id, display_name, avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      if (alive && prof && prof.id)
        setOther({ id: prof.id, display_name: prof.display_name, avatar_url: prof.avatar_url });
    })();
    return () => {
      alive = false;
    };
  }, [conversationId, userId]);

  // Realtime subscribe to new messages in this thread
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`thread:${conversationId}-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [conversationId, instanceId]);

  // Mark as read when opened / new messages arrive
  useEffect(() => {
    if (!conversationId || !userId) return;
    void supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
  }, [conversationId, userId, messages.length]);

  const send = useCallback(
    async (body: string, attachmentPath?: string | null) => {
      if (!conversationId || !userId) return;
      const text = body.trim().slice(0, 2000);
      if (!text && !attachmentPath) return;
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        body: text || "📎 Bild",
        attachment_path: attachmentPath ?? null,
      });
      if (error) return;
      // Fire-and-forget e-mail notification (respects the recipient's setting).
      void notifyNewMessage({
        data: {
          conversationId,
          preview: (text || "Skickade en bild").slice(0, 200),
        },
      }).catch(() => undefined);
    },
    [conversationId, userId],
  );

  return { messages, loading, other, send };
}

/** Upload an image into the private attachments bucket for a conversation. */
export async function uploadAttachment(
  conversationId: string,
  file: File | Blob,
  ext = "png",
): Promise<string> {
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: (file as File).type || "image/png" });
  if (error) throw error;
  return path;
}

/** Signed URL for a private attachment (1 hour). */
export async function attachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("attachments")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
