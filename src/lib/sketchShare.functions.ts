import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Creates (or revokes) a no-login link that always shows the project's
 * latest sketch version. Studio staff only.
 */
export const setSketchShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("id, artist_id, sketch_share_token")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    const { data: allowed } = await context.supabase.rpc("is_studio_staff", {
      _studio: project.artist_id,
      _user: context.userId,
    });
    if (!allowed) throw new Error("You do not have access to this project.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = data.enabled ? project.sketch_share_token ?? crypto.randomUUID().replace(/-/g, "") : null;
    const { error } = await supabaseAdmin
      .from("artist_client_projects")
      .update({ sketch_share_enabled: data.enabled, sketch_share_token: token })
      .eq("id", project.id);
    if (error) throw error;
    return { token, enabled: data.enabled };
  });

/** Public read of a shared sketch: returns a short-lived image URL. */
export const readSharedSketch = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result } = await supabaseAdmin.rpc("sketch_share_by_token", { _token: data.token });
    const payload = result as
      | {
          found: boolean;
          project_title?: string;
          studio_name?: string | null;
          version?: {
            version_number: number;
            storage_path: string;
            file_name: string;
            mime_type: string | null;
            change_comment: string | null;
            created_at: string;
            approved: boolean;
          } | null;
        }
      | null;
    if (!payload?.found) return { found: false as const };
    let url: string | null = null;
    if (payload.version) {
      const { data: signed } = await supabaseAdmin.storage
        .from("attachments")
        .createSignedUrl(payload.version.storage_path, 3600);
      url = signed?.signedUrl ?? null;
    }
    return {
      found: true as const,
      projectTitle: payload.project_title ?? "Tattoo design",
      studioName: payload.studio_name ?? null,
      version: payload.version ? { ...payload.version, url } : null,
    };
  });
