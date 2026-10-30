import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CaseFacts } from "@/lib/caseAction";

export type ArtistRequest = {
  id: string;
  artist_id: string;
  client_user_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  title: string;
  conversation_title: string | null;
  placement: string | null;
  size_cm: number | null;
  size_dimension?: "height" | "width" | "longest" | null;
  size_source?: "ar_calibrated" | "photo_calibrated" | "manual" | null;
  size_unsure?: boolean;
  placement_unsure?: boolean;
  reference_urls?: string[];
  description: string | null;
  color_mode: string | null;
  assigned_artist_id: string | null;
  quote_amount_ore: number | null;
  quote_message: string | null;
  quote_status: string;
  status: string;
  latest_activity_at: string;
  /** True when the client sent the same idea to a few studios to compare. */
  sent_to_multiple: boolean;

  source_project_id: string | null;
  scan_id: string | null;
  motif_url: string | null;
  base_photo_url: string | null;
  final_sketch_version_id: string | null;
  session_count: number;
  session_minutes: number;
  session_plan?: number[] | null;
  booking_link_session_plan?: number[] | null;
  created_at: string;
  booking_link_sent_at?: string | null;
  booking_link_session_count?: number | null;
  booking_link_session_minutes?: number | null;
  more_times_requested_at?: string | null;
  more_times_notified_at?: string | null;
  studio_read_at?: string | null;
};

/** Facts for the action/unread rules, built from rows already loaded. */
export function buildCaseFacts(
  r: ArtistRequest,
  extra: {
    lastClientMessageAt: string | null;
    lastStudioMessageAt: string | null;
    latestSketch: { versionNumber: number; approvedAt: string | null } | null;
    booking: { status: string; date: string | null } | null;
    deposit: { status: string } | null;
  },
): CaseFacts {
  return {
    status: r.status,
    createdAt: r.created_at,
    studioReadAt: r.studio_read_at ?? null,
    moreTimesRequestedAt: r.more_times_requested_at ?? null,
    moreTimesNotifiedAt: r.more_times_notified_at ?? null,
    bookingLinkSentAt: r.booking_link_sent_at ?? null,
    ...extra,
    booking: extra.booking && extra.booking.status !== "cancelled" ? extra.booking : null,
  };
}

export type SketchVersion = {
  id: string;
  project_id: string;
  version_number: number;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  change_comment: string;
  uploaded_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  signed_url?: string;
};

export type SketchAnnotation = {
  id: string;
  version_id: string;
  author_id: string;
  body: string;
  coordinate_kind: "image" | "model";
  pos_x: number;
  pos_y: number;
  pos_z: number | null;
  created_at: string;
};

export type ProjectDeposit = {
  id: string;
  project_id: string;
  amount_ore: number;
  status: "unpaid" | "paid" | "cancelled";
  paid_at: string | null;
  created_at: string;
  kind: "deposit" | "final";
  fortnox_invoice_number: string | null;
};

export type ProjectAttachment = {
  id: string;
  project_id: string;
  uploaded_by: string;
  kind: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  signed_url?: string;
};

export type ProjectMessage = {
  id: string;
  project_id: string;
  sender_id: string;
  body: string;
  attachment_id: string | null;
  created_at: string;
};

export type ProjectNote = {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

async function signAttachments(rows: ProjectAttachment[]) {
  return Promise.all(rows.map(async (row) => {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(row.storage_path, 3600);
    return { ...row, signed_url: data?.signedUrl };
  }));
}

async function signSketchVersions(rows: SketchVersion[]) {
  return Promise.all(rows.map(async (row) => {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(row.storage_path, 3600);
    return { ...row, signed_url: data?.signedUrl };
  }));
}

export function useArtistRequests(studioId: string | undefined) {
  const [requests, setRequests] = useState<ArtistRequest[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [facts, setFacts] = useState<Record<string, CaseFacts>>({});
  const [artists, setArtists] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (!studioId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const [{ data: projectRows }, { data: artistRows }] = await Promise.all([
      supabase.from("artist_client_projects").select("*").eq("artist_id", studioId).order("latest_activity_at", { ascending: false }),
      supabase.from("studio_artists").select("id,name").eq("studio_id", studioId).eq("active", true).order("sort_order"),
    ]);
    const next = (projectRows ?? []) as ArtistRequest[];
    setRequests(next);
    setArtists((artistRows ?? []) as { id: string; name: string }[]);
    if (next.length) {
      const { data: attachmentRows } = await supabase
        .from("artist_project_attachments")
        .select("*")
        .in("project_id", next.map((item) => item.id))
        .order("created_at", { ascending: false });
      const signed = await signAttachments((attachmentRows ?? []) as ProjectAttachment[]);
      const byProject: Record<string, string> = {};
      signed.forEach((item) => {
        if (!byProject[item.project_id] && item.signed_url) byProject[item.project_id] = item.signed_url;
      });
      setThumbnails(byProject);
      const ids = next.map((item) => item.id);
      const [msgs, sketches, bookings, deposits] = await Promise.all([
        supabase.from("artist_project_messages").select("project_id,sender_id,created_at").in("project_id", ids).order("created_at", { ascending: false }).limit(3000),
        supabase.from("artist_project_sketch_versions").select("project_id,version_number,approved_at").in("project_id", ids).order("version_number", { ascending: false }),
        supabase.from("bookings").select("artist_project_id,status,preferred_date").in("artist_project_id", ids).neq("status", "cancelled").order("created_at", { ascending: false }),
        supabase.from("project_deposits").select("project_id,status,kind").in("project_id", ids).eq("kind", "deposit").neq("status", "cancelled"),
      ]);
      const out: Record<string, CaseFacts> = {};
      for (const r of next) {
        let lastClient: string | null = null;
        let lastStudio: string | null = null;
        for (const m of msgs.data ?? []) {
          if (m.project_id !== r.id) continue;
          if (m.sender_id === r.client_user_id) lastClient ??= m.created_at;
          else lastStudio ??= m.created_at;
          if (lastClient && lastStudio) break;
        }
        const sk = (sketches.data ?? []).find((x) => x.project_id === r.id);
        const bk = (bookings.data ?? []).find((x) => x.artist_project_id === r.id);
        const dp = (deposits.data ?? []).find((x) => x.project_id === r.id);
        out[r.id] = buildCaseFacts(r, {
          lastClientMessageAt: lastClient,
          lastStudioMessageAt: lastStudio,
          latestSketch: sk ? { versionNumber: sk.version_number, approvedAt: sk.approved_at } : null,
          booking: bk ? { status: bk.status, date: bk.preferred_date } : null,
          deposit: dp ? { status: dp.status } : null,
        });
      }
      setFacts(out);
    }
    setLoading(false);
  }, [studioId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { requests, thumbnails, artists, loading, refresh, facts };
}

export async function loadProjectWorkspace(projectId: string, includeNotes: boolean) {
  const [projectResult, messageResult, attachmentResult, noteResult, bookingResult, sketchResult, depositResult] = await Promise.all([
    supabase.from("artist_client_projects").select("*").eq("id", projectId).maybeSingle(),
    supabase.from("artist_project_messages").select("*").eq("project_id", projectId).order("created_at"),
    supabase.from("artist_project_attachments").select("*").eq("project_id", projectId).order("created_at"),
    includeNotes ? supabase.from("artist_project_notes").select("*").eq("project_id", projectId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("bookings").select("id,status,preferred_date,preferred_time,duration_minutes").eq("artist_project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("artist_project_sketch_versions").select("*").eq("project_id", projectId).order("version_number"),
    supabase.from("project_deposits").select("id,project_id,amount_ore,status,paid_at,created_at,kind,fortnox_invoice_number").eq("project_id", projectId).neq("status", "cancelled"),
  ]);
  const sketches = (sketchResult.data ?? []) as SketchVersion[];
  const sketchIds = sketches.map((item) => item.id);
  const annotationResult: { data: unknown[] | null; error: unknown | null } = sketchIds.length
    ? await supabase.from("artist_project_sketch_annotations").select("*").in("version_id", sketchIds).order("created_at")
    : { data: [], error: null };
  const firstError = [projectResult.error, messageResult.error, attachmentResult.error, "error" in noteResult ? noteResult.error : null, bookingResult.error, sketchResult.error, depositResult.error, annotationResult.error]
    .find(Boolean);
  if (firstError) throw firstError;
  return {
    project: (projectResult.data ?? null) as ArtistRequest | null,
    messages: (messageResult.data ?? []) as ProjectMessage[],
    attachments: await signAttachments((attachmentResult.data ?? []) as ProjectAttachment[]),
    notes: (noteResult.data ?? []) as ProjectNote[],
    booking: bookingResult.data as { id: string; status: string; preferred_date: string; preferred_time: string | null; duration_minutes: number | null } | null,
    sketches: await signSketchVersions(sketches),
    sketchAnnotations: (annotationResult.data ?? []) as SketchAnnotation[],
    deposit: ((depositResult.data ?? []) as ProjectDeposit[]).find((d) => d.kind === "deposit") ?? null,
    finalPayment: ((depositResult.data ?? []) as ProjectDeposit[]).find((d) => d.kind === "final") ?? null,
  };
}

export async function uploadProjectAttachment(projectId: string, userId: string, file: File, kind = "reference") {
  if (file.size > 15 * 1024 * 1024) throw new Error("Files must be under 15 MB.");
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") throw new Error("Only images and PDFs are supported.");
  const path = `project/${projectId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.from("artist_project_attachments").insert({ project_id: projectId, uploaded_by: userId, kind, file_name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size }).select().single();
  if (error) throw error;
  return data as ProjectAttachment;
}

export async function uploadSketchFile(projectId: string, file: File) {
  const isImage = file.type.startsWith("image/");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const isModel = file.type === "model/gltf-binary" || file.type === "model/gltf+json" || extension === "glb" || extension === "gltf";
  if (!isImage && !isModel) throw new Error("Only images, GLB and GLTF files are supported.");
  if (file.size > 60 * 1024 * 1024) throw new Error("Sketch files must be under 60 MB.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `project/${projectId}/sketches/${crypto.randomUUID()}-${safeName}`;
  const contentType = file.type || (extension === "glb" ? "model/gltf-binary" : "model/gltf+json");
  const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType });
  if (error) throw error;
  return { path, contentType };
}