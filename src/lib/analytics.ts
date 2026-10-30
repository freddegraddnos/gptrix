/**
 * Lightweight share analytics: logs when a motif link is shared and when a
 * shared link is opened, so we can see which motifs spread the most.
 */
import { supabase } from "@/integrations/supabase/client";

type ShareKind = "share" | "open";

const sent = new Set<string>();

async function log(kind: ShareKind, motifId: string, channel?: string) {
  if (typeof window === "undefined") return;
  const id = String(motifId || "").slice(0, 64);
  if (!id) return;
  // De-dupe identical events within the same page session.
  const key = `${kind}:${id}:${channel ?? ""}`;
  if (kind === "open") {
    if (sent.has(key)) return;
    sent.add(key);
  }
  try {
    const { data } = await supabase.auth.getSession();
    await supabase.from("share_events").insert({
      motif_id: id,
      kind,
      channel: channel ? channel.slice(0, 32) : null,
      referrer: document.referrer ? document.referrer.slice(0, 200) : null,
      user_id: data.session?.user.id ?? null,
    });
  } catch {
    // analytics must never break the UX
  }
}

/** A user shared a motif (copy link, OS sheet, WhatsApp, ...). */
export function trackMotifShare(motifId: string, channel?: string) {
  void log("share", motifId, channel);
}

/** A shared link was opened by a recipient. */
export function trackShareOpen(motifId: string, channel?: string) {
  void log("open", motifId, channel);
}

export type TopSharedMotif = {
  motif_id: string;
  shares: number;
  opens: number;
};

/**
 * Aggregated leaderboard of the most shared motifs.
 * The RPC is restricted to signed-in users, so skip the call when signed out
 * instead of firing a request that always fails with 401.
 */
export async function fetchTopSharedMotifs(
  days = 30,
  limit = 10,
): Promise<TopSharedMotif[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return [];
  const { data, error } = await supabase.rpc("top_shared_motifs", {
    _days: days,
    _limit: limit,
  });
  if (error || !data) return [];
  return data as TopSharedMotif[];
}
