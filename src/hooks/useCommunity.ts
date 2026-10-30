import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FeedPost = {
  id: string;
  user_id: string;
  image_path: string;
  image_url: string | null;
  caption: string | null;
  body_part: string | null;
  tattoo_name: string | null;
  category: string | null;
  style: string | null;
  price_ore: number;
  try_count: number;
  created_at: string;
  author_name: string | null;
  author_handle: string | null;
  author_avatar: string | null;
  likes: number;
  liked_by_me: boolean;
  comments: number;
};


export type FeedComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
};

async function signImage(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("community")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export function useFeed(
  currentUserId: string | undefined,
  options?: { followingIds?: string[]; mode?: "all" | "following" },
) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const mode = options?.mode ?? "all";
  const followingIds = options?.followingIds ?? [];
  const followingKey = followingIds.slice().sort().join(",");

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(60);
    if (mode === "following") {
      const ids = followingKey ? followingKey.split(",") : [];
      if (ids.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      query = query.in("user_id", ids);
    }
    const { data: raw } = await query;
    const rows = raw ?? [];

    if (rows.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }
    const ids = rows.map((r) => r.id);
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const [{ data: profs }, { data: likes }, { data: comments }] =
      await Promise.all([
        supabase
          .from("public_profiles")
          .select("id, display_name, avatar_url, handle")
          .in("id", userIds),
        supabase.from("post_likes").select("post_id, user_id").in("post_id", ids),
        supabase.from("post_comments").select("post_id").in("post_id", ids),
      ]);
    const profileMap = new Map(
      (profs ?? []).map((p) => [p.id, p]),
    );
    const likeCount = new Map<string, number>();
    const likedByMe = new Set<string>();
    for (const l of likes ?? []) {
      likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1);
      if (currentUserId && l.user_id === currentUserId) likedByMe.add(l.post_id);
    }
    const commentCount = new Map<string, number>();
    for (const c of comments ?? []) {
      commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);
    }
    const signed = await Promise.all(
      rows.map(async (r) => {
        const url = await signImage(r.image_path);
        const prof = profileMap.get(r.user_id);
        return {
          id: r.id,
          user_id: r.user_id,
          image_path: r.image_path,
          image_url: url,
          caption: r.caption,
          body_part: r.body_part,
          tattoo_name: r.tattoo_name,
          category: r.category ?? null,
          style: r.style ?? null,
          price_ore: r.price_ore ?? 0,
          try_count: r.try_count ?? 0,
          created_at: r.created_at,
          author_name: prof?.display_name ?? null,
          author_handle: prof?.handle ?? null,
          author_avatar: prof?.avatar_url ?? null,
          likes: likeCount.get(r.id) ?? 0,
          liked_by_me: likedByMe.has(r.id),
          comments: commentCount.get(r.id) ?? 0,
        } satisfies FeedPost;
      }),
    );
    setPosts(signed);
    setLoading(false);
  }, [currentUserId, mode, followingKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!currentUserId) return;
      const p = posts.find((x) => x.id === postId);
      if (!p) return;
      // Optimistic
      setPosts((prev) =>
        prev.map((x) =>
          x.id === postId
            ? {
                ...x,
                liked_by_me: !x.liked_by_me,
                likes: x.likes + (x.liked_by_me ? -1 : 1),
              }
            : x,
        ),
      );
      if (p.liked_by_me) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", currentUserId);
      } else {
        await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: currentUserId });
      }
    },
    [currentUserId, posts],
  );

  const remove = useCallback(
    async (postId: string) => {
      await supabase.from("posts").delete().eq("id", postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    },
    [],
  );

  return { posts, loading, refresh, toggleLike, remove };
}

export function useComments(postId: string | null) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!postId) {
      setComments([]);
      return;
    }
    setLoading(true);
    const { data: raw } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const rows = raw ?? [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profs } = userIds.length
      ? await supabase
          .from("public_profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds)
      : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    setComments(
      rows.map((r) => ({
        id: r.id,
        post_id: r.post_id,
        user_id: r.user_id,
        body: r.body,
        created_at: r.created_at,
        author_name: map.get(r.user_id)?.display_name ?? null,
        author_avatar: map.get(r.user_id)?.avatar_url ?? null,
      })),
    );
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (userId: string, body: string) => {
      if (!postId || !body.trim()) return;
      await supabase
        .from("post_comments")
        .insert({ post_id: postId, user_id: userId, body: body.trim().slice(0, 500) });
      await refresh();
    },
    [postId, refresh],
  );

  return { comments, loading, add, refresh };
}

export async function createPost(input: {
  userId: string;
  imageDataUrl: string;
  caption?: string;
  bodyPart?: string;
  tattooName?: string;
  category?: string | null;
  style?: string | null;
  priceOre?: number | null;
}) {
  const blob = await (await fetch(input.imageDataUrl)).blob();
  const filename = `${crypto.randomUUID()}.png`;
  const path = `${input.userId}/${filename}`;
  const { error: upErr } = await supabase.storage
    .from("community")
    .upload(path, blob, { contentType: "image/png", upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: input.userId,
      image_path: path,
      caption: input.caption?.trim().slice(0, 500) || null,
      body_part: input.bodyPart ?? null,
      tattoo_name: input.tattooName ?? null,
      category: input.category ?? null,
      style: input.style ?? null,
      price_ore: Math.max(0, Math.round(input.priceOre ?? 0)),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Counts one "try in AR" for a feed design. Best effort — never throws. */
export async function incrementPostTry(postId: string) {
  try {
    await supabase.rpc("increment_post_try", { _post_id: postId });
  } catch {
    /* ignore */
  }
}

