import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StudioClientProject = {
  id: string;
  title: string;
  conversation_title: string | null;
  status: string;
  latest_activity_at: string;
};

export type StudioClientOverride = {
  client_key: string;
  client_user_id: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  state: "active" | "hidden" | "ended";
};

export type StudioClient = {
  key: string;
  clientUserId: string | null;
  name: string;
  originalName: string | null;
  handle: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  state: "active" | "hidden" | "ended";
  projects: StudioClientProject[];
  latestActivity: string;
};

/** Groups the studio's projects into one row per client, with studio overrides. */
export function clientKeyFor(row: {
  client_user_id: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_handle: string | null;
  client_name: string | null;
  id: string;
}) {
  if (row.client_user_id) return `user:${row.client_user_id}`;
  if (row.client_email) return `email:${row.client_email.trim().toLowerCase()}`;
  if (row.client_phone) return `phone:${row.client_phone.replace(/\s+/g, "")}`;
  if (row.client_handle) return `handle:${row.client_handle.trim().toLowerCase()}`;
  if (row.client_name) return `name:${row.client_name.trim().toLowerCase()}`;
  return `project:${row.id}`;
}

export function useStudioClients(studioId: string | undefined) {
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: projectRows }, { data: overrideRows }] = await Promise.all([
      supabase
        .from("artist_client_projects")
        .select("id,title,conversation_title,status,latest_activity_at,client_user_id,client_email,client_phone,client_handle,client_name")
        .eq("artist_id", studioId)
        .order("latest_activity_at", { ascending: false }),
      supabase
        .from("studio_clients")
        .select("client_key,client_user_id,display_name,email,phone,note,state")
        .eq("studio_id", studioId),
    ]);

    const overrides = new Map<string, StudioClientOverride>();
    ((overrideRows ?? []) as StudioClientOverride[]).forEach((row) => overrides.set(row.client_key, row));

    const grouped = new Map<string, StudioClient>();
    for (const row of projectRows ?? []) {
      const key = clientKeyFor(row);
      const override = overrides.get(key);
      const existing = grouped.get(key);
      const project: StudioClientProject = {
        id: row.id,
        title: row.title,
        conversation_title: row.conversation_title,
        status: row.status,
        latest_activity_at: row.latest_activity_at,
      };
      if (existing) {
        existing.projects.push(project);
        if (project.latest_activity_at > existing.latestActivity) existing.latestActivity = project.latest_activity_at;
        continue;
      }
      grouped.set(key, {
        key,
        clientUserId: row.client_user_id,
        name: override?.display_name || row.client_name || row.client_handle || row.client_email || "Unnamed client",
        originalName: row.client_name,
        handle: row.client_handle,
        email: override?.email || row.client_email,
        phone: override?.phone || row.client_phone,
        note: override?.note ?? null,
        state: override?.state ?? "active",
        projects: [project],
        latestActivity: row.latest_activity_at,
      });
    }

    setClients([...grouped.values()].sort((a, b) => (a.latestActivity < b.latestActivity ? 1 : -1)));
    setLoading(false);
  }, [studioId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return useMemo(() => ({ clients, loading, refresh }), [clients, loading, refresh]);
}
