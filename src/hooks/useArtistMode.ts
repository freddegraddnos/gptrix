import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ArtistAccount = {
  id: string;
  user_id: string;
  studio_name: string;
  city: string | null;
  handle: string | null;
  status: string;
  client_email?: string | null;
  client_phone?: string | null;
  placement?: string | null;
  size_cm?: number | null;
  description?: string | null;
  color_mode?: string | null;
  assigned_artist_id?: string | null;
  quote_amount_ore?: number | null;
  quote_message?: string | null;
  quote_status?: string;
  latest_activity_at?: string;
  source_project_id?: string | null;
  scan_id?: string | null;
  avatar_url: string | null;
  styles: string[];
  rating: number | null;
  review_count: number;
};

/** Verified statuses that grant access to artist mode. */
const VERIFIED = ["approved", "verified", "active"];

/**
 * Reads the logged-in user's artist role. `verified` determines whether
 * artist mode (client projects, previews) can be used.
 */
export function useArtistMode(userId: string | undefined) {
  const [artist, setArtist] = useState<ArtistAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setArtist(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("artist_profiles")
      .select(
        "id,user_id,studio_name,city,handle,status,avatar_url,styles,rating,review_count",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setArtist(data as ArtistAccount);
      setLoading(false);
      return;
    }
    const { data: membership } = await supabase
      .from("studio_members")
      .select("studio_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role", ["admin", "artist"])
      .limit(1)
      .maybeSingle();
    if (!membership) {
      setArtist(null);
      setLoading(false);
      return;
    }
    const { data: studio } = await supabase
      .from("artist_profiles")
      .select("id,user_id,studio_name,city,handle,status,avatar_url,styles,rating,review_count")
      .eq("user_id", membership.studio_id)
      .maybeSingle();
    setArtist((studio ?? null) as ArtistAccount | null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    artist,
    loading,
    isArtist: !!artist,
    verified: !!artist && VERIFIED.includes(artist.status),
    refresh,
  };
}

export type ClientProject = {
  id: string;
  artist_id: string;
  client_user_id: string | null;
  client_handle: string | null;
  client_name: string | null;
  title: string;
  notes: string | null;
  base_photo_url: string | null;
  motif_url: string | null;
  design: Record<string, unknown>;
  before_url: string | null;
  after_url: string | null;
  preview_token: string;
  invite_token: string;
  publish_approved: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

/** The artist's client projects, searchable per client. */
export function useClientProjects(artistId: string | undefined) {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!artistId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("artist_client_projects")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false });
    setProjects((data ?? []) as ClientProject[]);
    setLoading(false);
  }, [artistId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: {
      title: string;
      clientName?: string;
      clientHandle?: string;
      clientUserId?: string | null;
    }) => {
      if (!artistId) return null;
      const { data, error } = await supabase
        .from("artist_client_projects")
        .insert({
          artist_id: artistId,
          title: input.title,
          client_name: input.clientName ?? null,
          client_handle: input.clientHandle ?? null,
          client_user_id: input.clientUserId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return data as ClientProject;
    },
    [artistId, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("artist_client_projects").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  return { projects, loading, refresh, create, remove };
}

/** Searches users by username to link a client to a project. */
export async function searchClients(q: string) {
  const { data } = await supabase.rpc("search_user_handles", { _q: q });
  return (data ?? []) as {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  }[];
}
