import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readTattooOffer, type TattooOffer } from "@/lib/tattooOffer";
import { watermarkImage } from "@/lib/watermark";


export type MarketplaceMotif = TattooOffer & {
  id: string;
  artist_id: string;
  name: string;
  description: string | null;
  image_path: string;
  image_url: string | null;
  price_ore: number;
  usage_terms: string | null;
  tags: string[];
  style: string | null;
  category: string | null;
  placements: string[];
  coverage: string;
  artist_name: string | null;
  owned?: boolean;
  purchased?: boolean;
};

async function signImage(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("marketplace")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Ids of the paid designs this user has bought. */
async function ownedMotifIds(userId?: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await supabase
    .from("motif_purchases")
    .select("motif_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.motif_id));
}

/**
 * Paid designs stay watermarked until they are bought; free designs are
 * shown as-is.
 */
async function displayImage(url: string | null, owned: boolean): Promise<string | null> {
  if (!url || owned) return url;
  try {
    return await watermarkImage(url);
  } catch {
    return url;
  }
}

export function useMarketplace(currentUserId?: string) {
  const [motifs, setMotifs] = useState<MarketplaceMotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data: rows, error: rowsError } = await supabase
      .from("marketplace_motifs")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (rowsError) {
      setError(true);
      setMotifs([]);
      setLoading(false);
      return;
    }

    const ids = rows?.map((r) => r.artist_id) ?? [];
    const uniqueArtists = Array.from(new Set(ids));
    const { data: profiles } = await supabase
      .from("public_profiles")
      .select("id, display_name")
      .in("id", uniqueArtists.length ? uniqueArtists : ["00000000-0000-0000-0000-000000000000"]);
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    const purchased = await ownedMotifIds(currentUserId);

    const signed = await Promise.all(
      (rows ?? []).map(async (r) => {
        // Free designs and your own uploads are always unlocked.
        const owned =
          r.price_ore === 0 || r.artist_id === currentUserId || purchased.has(r.id);
        const wasPurchased = purchased.has(r.id);
        const url = await signImage(r.image_path);
        return {
          ...readTattooOffer(r),
          id: r.id,
          artist_id: r.artist_id,
          name: r.name,
          description: r.description,
          image_path: r.image_path,
          image_url: await displayImage(url, owned),
          price_ore: r.price_ore,
          usage_terms: r.usage_terms ?? null,
          tags: r.tags ?? [],
          style: r.style ?? null,
          category: r.category ?? null,
          placements: r.placements ?? [],
          coverage: r.coverage ?? "single",
          artist_name: profMap.get(r.artist_id) ?? null,
          owned,
          purchased: wasPurchased,
        };
      }),
    );
    setMotifs(signed);
    setLoading(false);
  }, [currentUserId]);


  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { motifs, loading, error, refresh };
}

export function useMotif(id: string | undefined, currentUserId?: string) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [motif, setMotif] = useState<MarketplaceMotif | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setMotif(null);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: r } = await supabase
        .from("marketplace_motifs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!r) {
        setMotif(null);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("public_profiles")
        .select("display_name")
        .eq("id", r.artist_id)
        .maybeSingle();
      // Paid designs stay locked (and watermarked) until they are bought.
      const purchased = await ownedMotifIds(currentUserId);
      const owned =
        r.price_ore === 0 || r.artist_id === currentUserId || purchased.has(r.id);
      const wasPurchased = purchased.has(r.id);
      const url = await signImage(r.image_path);
      setMotif({
        ...readTattooOffer(r),
        id: r.id,
        artist_id: r.artist_id,
        name: r.name,
        description: r.description,
        image_path: r.image_path,
        image_url: await displayImage(url, owned),
        price_ore: r.price_ore,
        usage_terms: r.usage_terms ?? null,
        tags: r.tags ?? [],
        style: r.style ?? null,
        category: r.category ?? null,
          placements: r.placements ?? [],
          coverage: r.coverage ?? "single",
        artist_name: profile?.display_name ?? null,
        owned,
        purchased: wasPurchased,
      });

      setLoading(false);
    })();
  }, [id, currentUserId, refreshKey]);

  return { motif, loading, refresh: () => setRefreshKey(key => key + 1) };
}

export function formatKr(ore: number): string {
  return `${(ore / 100).toFixed(0)} kr`;
}
