import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProjectAssetKind =
  | "motif"
  | "reference"
  | "body"
  | "idea"
  | "final_design"
  | "real";


export type ProjectAsset = {
  id: string;
  project_id: string;
  user_id: string;
  kind: string;
  title: string | null;
  note: string | null;
  image_url: string;
  created_at: string;
};

export type ProjectVersion = {
  id: string;
  project_id: string;
  label: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
};

export type ProjectDetail = {
  id: string;
  user_id: string;
  name: string;
  body_part: string | null;
  tattoo_id: string | null;
  tattoo_name: string | null;
  width_cm: number | null;
  preview_url: string | null;
  cover_url: string | null;
  notes: string | null;
  placement_note: string | null;
  artist_user_id: string | null;
  artist_name: string | null;
  booking_status: string;
  /** Which tab the project is shown in on the public profile. */
  shelf: string;
  collection: string | null;
  /** Whether the tattoo journey (timeline) is shown on the public profile. */
  journey_public: boolean;
  size_dimension: "height" | "width" | "longest" | null;
  size_source: "ar_calibrated" | "photo_calibrated" | "manual" | null;
  size_unsure: boolean;
  placement_unsure: boolean;
  shared_reference_ids: string[];
  created_at: string;
  updated_at: string;

};

export const BOOKING_STATUSES: { value: string; label: string }[] = [
  { value: "none", label: "No booking" },
  { value: "planning", label: "Planning" },
  { value: "inquiry", label: "Inquiry sent" },
  { value: "booked", label: "Booked" },
  { value: "done", label: "Done" },
];

/** Public profile's tabs. */
export const SHELVES: { value: string; label: string }[] = [
  { value: "tattoo", label: "Tattoos" },
  { value: "design", label: "Designs" },
  { value: "considering", label: "Considering" },
];


/** A project's entire workspace: metadata, assets, and version history. */
export function useProjectWorkspace(
  projectId: string | undefined,
  userId: string | undefined,
) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId || !userId) return;
    setLoading(true);
    const [p, a, v] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase
        .from("project_assets")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_versions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);
    setProject((p.data ?? null) as ProjectDetail | null);
    setAssets((a.data ?? []) as ProjectAsset[]);
    setVersions((v.data ?? []) as ProjectVersion[]);
    setLoading(false);
  }, [projectId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveVersion = useCallback(
    async (label: string, snapshot: Record<string, unknown>) => {
      if (!projectId || !userId) return;
      await supabase.from("project_versions").insert({
        project_id: projectId,
        user_id: userId,
        label,
        snapshot: snapshot as never,
      });
      await refresh();
    },
    [projectId, userId, refresh],
  );

  const update = useCallback(
    async (patch: Partial<ProjectDetail>, versionLabel?: string) => {
      if (!projectId || !userId) return;
      await supabase.from("projects").update(patch).eq("id", projectId);
      if (versionLabel) {
        await supabase.from("project_versions").insert({
          project_id: projectId,
          user_id: userId,
          label: versionLabel,
          snapshot: patch as never,
        });
      }
      await refresh();
    },
    [projectId, userId, refresh],
  );

  const addAsset = useCallback(
    async (input: {
      kind: ProjectAssetKind;
      imageUrl: string;
      title?: string;
      note?: string;
    }) => {
      if (!projectId || !userId) return;
      await supabase.from("project_assets").insert({
        project_id: projectId,
        user_id: userId,
        kind: input.kind,
        image_url: input.imageUrl,
        title: input.title ?? null,
        note: input.note ?? null,
      });
      await refresh();
    },
    [projectId, userId, refresh],
  );

  const removeAsset = useCallback(
    async (id: string) => {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      await supabase.from("project_assets").delete().eq("id", id);
    },
    [],
  );

  return {
    project,
    assets,
    versions,
    loading,
    refresh,
    update,
    addAsset,
    removeAsset,
    saveVersion,
  };
}
