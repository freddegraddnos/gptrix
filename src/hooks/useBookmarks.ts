/**
 * Bookmarks (star marking) for gallery images.
 *
 * - Logged out: saved locally in localStorage (no friction in onboarding).
 * - Logged in: synced against the `bookmarks` table, and local bookmarks
 *   are migrated up on the first logged-in load.
 * - Optimistic UI: state updates immediately, only rolled back on error.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const KEY = "inkvision.bookmarks.v1";
const EVT = "inkvision:bookmarks";

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVT));
}

export function useBookmarks() {
  const { user, loading: authLoading } = useAuth();
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Local bookmarks (logged out) + sync between components
  useEffect(() => {
    if (user) return;
    const sync = () => setIds(readLocal());
    sync();
    setLoading(authLoading);
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [user, authLoading]);

  // Logged in: fetch from the server and migrate any local bookmarks
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      const local = readLocal();
      if (local.length > 0) {
        await supabase
          .from("bookmarks")
          .upsert(
            local.map((image_id) => ({ user_id: user.id, image_id })),
            { onConflict: "user_id,image_id" },
          );
        writeLocal([]);
      }
      const { data } = await supabase
        .from("bookmarks")
        .select("image_id")
        .order("created_at", { ascending: false });
      if (!alive) return;
      setIds((data ?? []).map((r) => r.image_id));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const isBookmarked = useCallback(
    (imageId: string) => ids.includes(imageId),
    [ids],
  );

  const toggle = useCallback(
    async (imageId: string) => {
      const was = ids.includes(imageId);
      const next = was ? ids.filter((i) => i !== imageId) : [imageId, ...ids];
      setIds(next); // optimistic

      if (!user) {
        writeLocal(next);
        return !was;
      }

      const { error } = was
        ? await supabase
            .from("bookmarks")
            .delete()
            .eq("user_id", user.id)
            .eq("image_id", imageId)
        : await supabase
            .from("bookmarks")
            .upsert(
              { user_id: user.id, image_id: imageId },
              { onConflict: "user_id,image_id" },
            );

      if (error) {
        setIds(ids); // roll back
        throw error;
      }
      return !was;
    },
    [ids, user],
  );

  return { ids, isBookmarked, toggle, loading, signedIn: !!user };
}
