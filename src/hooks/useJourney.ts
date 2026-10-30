import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { computeJourney, tickStreak, type JourneyStats } from "@/lib/journey";

/**
 * Derives the current user's journey stats from live app signals.
 * Falls back to zeros while data is loading.
 */
export function useJourney(): JourneyStats {
  const { user } = useAuth();
  const { isActive } = useSubscription(user?.id);
  const { projects } = useProjects(user?.id);
  const [postsCount, setPostsCount] = useState(0);
  const [motifsOwned, setMotifsOwned] = useState(0);
  const [flags, setFlags] = useState({
    usedAdvisor: false,
    usedCompare: false,
    usedAr: false,
    calibrated: false,
  });

  useEffect(() => {
    tickStreak();
    if (typeof window !== "undefined") {
      setFlags({
        usedAdvisor: localStorage.getItem("inkvision.flag.advisor") === "1",
        usedCompare: localStorage.getItem("inkvision.flag.compare") === "1",
        usedAr: localStorage.getItem("inkvision.flag.ar") === "1",
        calibrated:
          !!localStorage.getItem("tattooar.access.v2") &&
          !!JSON.parse(localStorage.getItem("tattooar.access.v2") ?? "{}").pxPerCm,
      });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ count: pc }, { count: mc }] = await Promise.all([
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("motif_purchases")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      setPostsCount(pc ?? 0);
      setMotifsOwned(mc ?? 0);
    })();
  }, [user]);

  return computeJourney({
    projectCount: projects.length,
    motifsOwned,
    postsShared: postsCount,
    hasSubscription: isActive,
    ...flags,
  });
}

/** Records that the user has visited a feature (for badges). Idempotent. */
export function markFlag(key: "advisor" | "compare" | "ar") {
  if (typeof window === "undefined") return;
  localStorage.setItem(`inkvision.flag.${key}`, "1");
}
