import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStudioStaff(context: { supabase: any; userId: string }, studioId: string) {
  const { data: allowed } = await context.supabase.rpc("is_studio_staff", {
    _studio: studioId,
    _user: context.userId,
  });
  if (!allowed) throw new Error("You do not have access to this studio inbox.");
}

async function threadForStaff(context: { supabase: any; userId: string }, threadId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: thread } = await supabaseAdmin
    .from("instagram_threads")
    .select(
      "id, studio_id, participant_id, participant_name, participant_username, project_id, last_inbound_at",
    )
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) throw new Error("Conversation not found.");
  await assertStudioStaff(context, thread.studio_id);
  return { thread, supabaseAdmin };
}

/** Tells the studio panel whether Instagram is available and connected. */
export const getInstagramSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStudioStaff(context, data.studioId);
    const { instagramConfig, getInstagramLink, checkInstagramPermissions } =
      await import("@/lib/instagram.server");
    const configured = Boolean(instagramConfig());
    if (!configured) {
      return {
        configured: false,
        linked: false,
        username: null as string | null,
        accountType: null as string | null,
        permissionsOk: false,
      };
    }
    const link = await getInstagramLink(data.studioId).catch(() => null);
    if (!link) {
      return {
        configured: true,
        linked: false,
        username: null,
        accountType: null,
        permissionsOk: false,
      };
    }
    const perms = await checkInstagramPermissions(data.studioId).catch(() => null);
    const permissionsOk = perms
      ? perms.instagram_business_basic && perms.instagram_business_manage_messages
      : true;
    return {
      configured: true,
      linked: true,
      username: link.username,
      accountType: link.accountType,
      permissionsOk,
    };
  });

/** Builds the Instagram consent URL for this studio. */
export const startInstagramConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStudioStaff(context, data.studioId);
    const { instagramConfig, authorizeUrl, signState } = await import("@/lib/instagram.server");
    const config = instagramConfig();
    if (!config) throw new Error("Instagram is not set up for this app yet.");
    const request = getRequest();
    if (!request) throw new Error("Connecting must start from an app request.");
    const url = new URL(request.url);
    const origin = url.hostname === "localhost" ? "https://www.inksimulator.com" : url.origin;
    return {
      authorizationUrl: authorizeUrl(config, origin, signState(data.studioId, config.appSecret)),
    };
  });

export const disconnectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStudioStaff(context, data.studioId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("studio_instagram_links").delete().eq("studio_id", data.studioId);
    return { ok: true };
  });

/** Sends a DM from the studio account and mirrors it into the thread. */
export const sendInstagramReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ threadId: z.string().uuid(), body: z.string().trim().min(1).max(950) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { thread } = await threadForStaff(context, data.threadId);
    const { sendInstagramDm, recordInstagramMessage } = await import("@/lib/instagram.server");
    const messageId = await sendInstagramDm(thread.studio_id, thread.participant_id, data.body);
    await recordInstagramMessage({
      studioId: thread.studio_id,
      participantId: thread.participant_id,
      direction: "out",
      body: data.body,
      igMessageId: messageId,
    });
    return { ok: true };
  });

export const markInstagramThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { thread, supabaseAdmin } = await threadForStaff(context, data.threadId);
    await supabaseAdmin.from("instagram_threads").update({ unread_count: 0 }).eq("id", thread.id);
    return { ok: true };
  });

/** Turns an Instagram conversation into a real InkSimulator project. */
export const createProjectFromThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ threadId: z.string().uuid(), title: z.string().trim().min(1).max(120) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { thread, supabaseAdmin } = await threadForStaff(context, data.threadId);
    if (thread.project_id) return { projectId: thread.project_id };

    const clientName =
      thread.participant_name ?? thread.participant_username ?? "Instagram customer";
    const { data: project, error } = await supabaseAdmin
      .from("artist_client_projects")
      .insert({
        artist_id: thread.studio_id,
        title: data.title,
        client_name: clientName,
        status: "open",
        acquisition_source: "instagram",
      })
      .select("id")
      .single();
    if (error || !project) throw error ?? new Error("Could not create the project.");
    await supabaseAdmin
      .from("instagram_threads")
      .update({ project_id: project.id })
      .eq("id", thread.id);
    return { projectId: project.id };
  });
