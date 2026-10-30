import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clientSchema = z.object({
  studioId: z.string().uuid(),
  clientKey: z.string().trim().min(1).max(200),
  clientUserId: z.string().uuid().nullable().optional(),
  displayName: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

const stateSchema = z.object({
  studioId: z.string().uuid(),
  clientKey: z.string().trim().min(1).max(200),
  clientUserId: z.string().uuid().nullable().optional(),
  state: z.enum(["active", "hidden", "ended"]),
  projectIds: z.array(z.string().uuid()).max(200).default([]),
});

const renameSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().max(120),
});

/** Fails unless the signed-in user belongs to the studio team. */
async function assertStudioStaff(
  supabase: { rpc: (name: "is_studio_staff", args: { _studio: string; _user: string }) => Promise<{ data: boolean | null }> },
  studioId: string,
  userId: string,
) {
  const { data } = await supabase.rpc("is_studio_staff", { _studio: studioId, _user: userId });
  if (!data) throw new Error("Only studio team members can manage clients.");
}

/** Creates or updates the studio's own record of a client. */
export const upsertStudioClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => clientSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStudioStaff(context.supabase as never, data.studioId, context.userId);
    const { data: row, error } = await context.supabase
      .from("studio_clients")
      .upsert(
        {
          studio_id: data.studioId,
          client_key: data.clientKey,
          client_user_id: data.clientUserId ?? null,
          display_name: data.displayName || null,
          email: data.email || null,
          phone: data.phone || null,
          note: data.note || null,
        },
        { onConflict: "studio_id,client_key" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });

/** Hides, ends or reopens a client relationship. Ending archives open projects. */
export const setStudioClientState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => stateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStudioStaff(context.supabase as never, data.studioId, context.userId);
    const { error } = await context.supabase
      .from("studio_clients")
      .upsert(
        {
          studio_id: data.studioId,
          client_key: data.clientKey,
          client_user_id: data.clientUserId ?? null,
          state: data.state,
        },
        { onConflict: "studio_id,client_key" },
      );
    if (error) throw error;

    if (data.state === "ended" && data.projectIds.length) {
      await context.supabase
        .from("artist_client_projects")
        .update({ status: "archived" })
        .in("id", data.projectIds)
        .eq("artist_id", data.studioId)
        .in("status", ["open", "sketch_in_progress", "changes_requested", "approved"]);
    }
    return { ok: true };
  });

/** Studio-side label for a project conversation. Empty string clears it. */
export const renameProjectConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => renameSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("artist_client_projects")
      .select("artist_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    await assertStudioStaff(context.supabase as never, project.artist_id, context.userId);
    const { error } = await context.supabase
      .from("artist_client_projects")
      .update({ conversation_title: data.title || null })
      .eq("id", data.projectId);
    if (error) throw error;
    return { ok: true };
  });
