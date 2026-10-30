import { publicSiteUrl } from "@/lib/publicOrigin";
/** Shared helper: notify the other party on an artist/client project. */
export async function notifyProjectParty(
  projectId: string,
  actorId: string,
  title: string,
  body: string,
  eventKey: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: project } = await supabaseAdmin
    .from("artist_client_projects")
    .select("artist_id,client_user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return;
  const recipient = actorId === project.client_user_id ? project.artist_id : project.client_user_id;
  if (!recipient) return;
  const url =
    recipient === project.artist_id ? `/artists/requests/${projectId}` : `/requests/${projectId}`;
  const { notifyUser } = await import("@/lib/notify.server");
  await notifyUser(recipient, {
    kind: "change",
    title,
    body,
    url,
    inApp: { kind: "message", actorId },
    email: {
      template: "new-message",
      templateData: {
        senderName: "InkSimulator",
        preview: body,
        link: publicSiteUrl(`${url}`),
      },
      idempotencyKey: eventKey,
    },
  }).catch(() => undefined);
}
